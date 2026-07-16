import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { withTenant } from "../../src/lib/db/with-tenant";
import { publishAnnouncement } from "../../src/lib/announcements/publish";
import { remindPendingUsers } from "../../src/lib/announcements/remind-pending";
import { InAppNotificationChannel } from "../../src/lib/notifications/in-app-channel";
import { PushNotificationChannel } from "../../src/lib/notifications/push-channel";
import { CompositeNotificationChannel } from "../../src/lib/notifications/composite-channel";
import { deletePushSubscriptionById, savePushSubscription } from "../../src/lib/repositories/push-subscription.repository";
import { createAnnouncementDraft } from "../../src/lib/repositories/announcement.repository";
import { createAnnouncementVersion } from "../../src/lib/repositories/announcement-version.repository";
import { replaceAnnouncementAudience } from "../../src/lib/repositories/announcement-audience.repository";

const ownerDb = new PrismaClient();

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Remind Pending Push Test ${suffix}`,
    slug: `remind-pending-push-test-${suffix}`,
    branchCount: 1,
    userCount: 6,
    cpfSeedOffset: 980,
    includeSampleAnnouncements: false,
  });
}, 60_000);

afterAll(async () => {
  await ownerDb.$executeRawUnsafe("ALTER TABLE announcement_acks DISABLE TRIGGER USER");
  try {
    await ownerDb.notification.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.pushSubscription.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.announcementAck.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.announcementSequence.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.announcement.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.post.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.jobOpening.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.user.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.tenant.deleteMany({ where: { id: tenant.tenant.id } });
  } finally {
    await ownerDb.$executeRawUnsafe("ALTER TABLE announcement_acks ENABLE TRIGGER USER");
  }
  await ownerDb.$disconnect();
});

afterEach(async () => {
  await ownerDb.pushSubscription.deleteMany({ where: { tenantId: tenant.tenant.id } });
  await ownerDb.notification.deleteMany({ where: { tenantId: tenant.tenant.id } });
});

async function createPublishedRequiresAck(title: string) {
  return withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
    const draft = await createAnnouncementDraft(tx, {
      tenantId: tenant.tenant.id,
      category: "seguranca",
      criticality: "requires_ack",
      createdBy: tenant.users[0].id,
    });
    await createAnnouncementVersion(tx, {
      tenantId: tenant.tenant.id,
      announcementId: draft.id,
      title,
      body: "<p>corpo</p>",
      createdBy: tenant.users[0].id,
    });
    await replaceAnnouncementAudience(tx, tenant.tenant.id, draft.id, [tenant.branches[0].id]);
    await publishAnnouncement(tx, { tenantId: tenant.tenant.id, announcementId: draft.id });
    return draft.id;
  });
}

function unreadNotificationsFor(userId: string, announcementId: string) {
  return ownerDb.notification.findMany({ where: { tenantId: tenant.tenant.id, userId, announcementId } });
}

describe("push combinado a in-app na cobranca de pendentes (INC-012)", () => {
  it("1 pendente com subscription = exatamente 1 notificacao in-app + 1 tentativa de push, sem duplicar a deteccao de pendencia", async () => {
    // status "active": buildTenantFixtures sempre marca o ULTIMO usuario como
    // inactive (para outros testes) — precisa ser excluido do publico-alvo.
    const pendingUser = tenant.users.find((u) => u.role === "employee" && u.status === "active")!;
    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      savePushSubscription(tx, {
        tenantId: tenant.tenant.id,
        userId: pendingUser.id,
        endpoint: "https://push.example/pending-user",
        keys: { p256dh: "p256dh", auth: "auth" },
      }),
    );

    const sendPush = vi.fn().mockResolvedValue(undefined);
    const channel = new CompositeNotificationChannel([
      new InAppNotificationChannel(),
      new PushNotificationChannel(sendPush),
    ]);

    const announcementId = await createPublishedRequiresAck("Cobranca — push combinado");

    const outcome = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      remindPendingUsers(tx, tenant.tenant.id, announcementId, {}, channel),
    );

    const activeInBranch = tenant.users.filter((u) => u.branchId === tenant.branches[0].id && u.status === "active");
    expect(outcome?.notifiedCount).toBe(activeInBranch.length);
    expect(await unreadNotificationsFor(pendingUser.id, announcementId)).toHaveLength(1);
    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(sendPush).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://push.example/pending-user" }),
      expect.any(String),
    );
  });

  it("push expirado (410) e' autolimpo, mas nunca aborta a notificacao in-app da cobranca", async () => {
    // status "active": buildTenantFixtures sempre marca o ULTIMO usuario como
    // inactive (para outros testes) — precisa ser excluido do publico-alvo.
    const pendingUser = tenant.users.find((u) => u.role === "employee" && u.status === "active")!;
    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      savePushSubscription(tx, {
        tenantId: tenant.tenant.id,
        userId: pendingUser.id,
        endpoint: "https://push.example/expired-subscription",
        keys: { p256dh: "p256dh", auth: "auth" },
      }),
    );

    const sendPush = vi.fn().mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));
    const channel = new CompositeNotificationChannel([
      new InAppNotificationChannel(),
      new PushNotificationChannel(sendPush),
    ]);

    const announcementId = await createPublishedRequiresAck("Cobranca — push expirado");

    const outcome = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      remindPendingUsers(tx, tenant.tenant.id, announcementId, {}, channel),
    );

    expect(outcome).not.toBeNull();
    expect(await unreadNotificationsFor(pendingUser.id, announcementId)).toHaveLength(1);

    const remaining = await ownerDb.pushSubscription.findMany({
      where: { tenantId: tenant.tenant.id, userId: pendingUser.id },
    });
    expect(remaining).toHaveLength(0);
  });

  it("revogar a subscription (perfil) interrompe o envio na proxima cobranca", async () => {
    const pendingUser = tenant.users.find((u) => u.role === "employee" && u.status === "active")!;
    const subscription = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      savePushSubscription(tx, {
        tenantId: tenant.tenant.id,
        userId: pendingUser.id,
        endpoint: "https://push.example/to-be-revoked",
        keys: { p256dh: "p256dh", auth: "auth" },
      }),
    );

    // Mesma operacao que revokeOwnPushSubscriptionAction (perfil) faz.
    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      deletePushSubscriptionById(tx, tenant.tenant.id, pendingUser.id, subscription.id),
    );

    const sendPush = vi.fn().mockResolvedValue(undefined);
    const channel = new CompositeNotificationChannel([
      new InAppNotificationChannel(),
      new PushNotificationChannel(sendPush),
    ]);

    const announcementId = await createPublishedRequiresAck("Cobranca — apos revogar push");

    const outcome = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      remindPendingUsers(tx, tenant.tenant.id, announcementId, {}, channel),
    );

    expect(outcome).not.toBeNull();
    expect(sendPush).not.toHaveBeenCalled();
    expect(await unreadNotificationsFor(pendingUser.id, announcementId)).toHaveLength(1);
  });
});
