import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { withTenant } from "../../src/lib/db/with-tenant";
import { publishAnnouncement } from "../../src/lib/announcements/publish";
import { remindPendingUsers } from "../../src/lib/announcements/remind-pending";
import { InAppNotificationChannel } from "../../src/lib/notifications/in-app-channel";
import { createAnnouncementDraft } from "../../src/lib/repositories/announcement.repository";
import { createAnnouncementVersion } from "../../src/lib/repositories/announcement-version.repository";
import { replaceAnnouncementAudience } from "../../src/lib/repositories/announcement-audience.repository";
import { createAnnouncementAckIdempotent } from "../../src/lib/repositories/announcement-ack.repository";

const ownerDb = new PrismaClient();
const channel = new InAppNotificationChannel();

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Remind Pending Test ${suffix}`,
    slug: `remind-pending-test-${suffix}`,
    branchCount: 2,
    userCount: 10,
    cpfSeedOffset: 960,
    includeSampleAnnouncements: false,
  });
}, 60_000);

afterAll(async () => {
  await ownerDb.$executeRawUnsafe("ALTER TABLE announcement_acks DISABLE TRIGGER USER");
  try {
    await ownerDb.notification.deleteMany({ where: { tenantId: tenant.tenant.id } });
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

async function createPublishedRequiresAck(title: string, branchIds: string[] = []) {
  return withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
    const draft = await createAnnouncementDraft(tx, {
      tenantId: tenant.tenant.id,
      category: "seguranca",
      criticality: "requires_ack",
      createdBy: tenant.users[0].id,
    });
    const version = await createAnnouncementVersion(tx, {
      tenantId: tenant.tenant.id,
      announcementId: draft.id,
      title,
      body: "<p>corpo</p>",
      createdBy: tenant.users[0].id,
    });
    if (branchIds.length > 0) {
      await replaceAnnouncementAudience(tx, tenant.tenant.id, draft.id, branchIds);
    }
    await publishAnnouncement(tx, { tenantId: tenant.tenant.id, announcementId: draft.id });
    return { announcementId: draft.id, versionId: version.id };
  });
}

function ackAs(userId: string, announcementId: string, versionId: string) {
  return withTenant({ tenantId: tenant.tenant.id }, (tx) =>
    createAnnouncementAckIdempotent(tx, {
      tenantId: tenant.tenant.id,
      announcementId,
      versionId,
      userId,
      contentHashAtAck: "hash-fixo-do-teste",
    }),
  );
}

function unreadNotificationsFor(userId: string, announcementId: string) {
  return ownerDb.notification.findMany({ where: { tenantId: tenant.tenant.id, userId, announcementId } });
}

describe("cobrar pendentes reusa o painel de pendencias do INC-006", () => {
  it("notifica so quem esta em .pending, nao quem ja confirmou", async () => {
    const branchA = tenant.branches[0];
    const activeInA = tenant.users.filter((u) => u.branchId === branchA.id && u.status === "active");
    const [acked, ...others] = activeInA;

    const { announcementId, versionId } = await createPublishedRequiresAck("Cobranca — so pendentes", [branchA.id]);
    await ackAs(acked.id, announcementId, versionId);

    const outcome = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      remindPendingUsers(tx, tenant.tenant.id, announcementId, {}, channel),
    );

    expect(outcome?.notifiedCount).toBe(others.length);
    expect(await unreadNotificationsFor(acked.id, announcementId)).toHaveLength(0);
    for (const user of others) {
      expect(await unreadNotificationsFor(user.id, announcementId)).toHaveLength(1);
    }
  });
});

describe("nao notifica quem confirma entre o clique e o processamento", () => {
  it("ack committado antes da transacao de cobranca exclui o usuario da notificacao", async () => {
    const branchA = tenant.branches[0];
    const activeInA = tenant.users.filter((u) => u.branchId === branchA.id && u.status === "active");
    const userWhoRaces = activeInA[0];

    const { announcementId, versionId } = await createPublishedRequiresAck("Cobranca — corrida de ack", [branchA.id]);

    // Simula a janela clique->processamento: o ack comita numa transacao
    // separada ANTES da cobranca rodar — nunca dentro da mesma transacao
    // (isso testaria outra coisa: leitura consistente dentro de 1 tx, nao a
    // janela real entre o clique do admin e o processamento da cobranca).
    await ackAs(userWhoRaces.id, announcementId, versionId);

    const outcome = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      remindPendingUsers(tx, tenant.tenant.id, announcementId, {}, channel),
    );

    expect(outcome).not.toBeNull();
    expect(await unreadNotificationsFor(userWhoRaces.id, announcementId)).toHaveLength(0);
  });
});

describe("isolamento de gestor", () => {
  it("manager so cobra pendentes da propria filial", async () => {
    const branchA = tenant.branches[0];
    const branchB = tenant.branches[1];
    const managerA = tenant.users.find((u) => u.role === "manager" && u.branchId === branchA.id)!;
    const pendingInB = tenant.users.find((u) => u.role === "employee" && u.branchId === branchB.id && u.status === "active")!;

    const { announcementId } = await createPublishedRequiresAck("Cobranca — todas as filiais");

    const outcome = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      remindPendingUsers(tx, tenant.tenant.id, announcementId, { branchId: managerA.branchId }, channel),
    );

    expect(outcome).not.toBeNull();
    expect(await unreadNotificationsFor(pendingInB.id, announcementId)).toHaveLength(0);
    for (const user of tenant.users.filter((u) => u.branchId === branchA.id && u.status === "active")) {
      expect(await unreadNotificationsFor(user.id, announcementId)).toHaveLength(1);
    }
  });

  it("devolve null quando o comunicado esta fora do escopo do gestor", async () => {
    const branchA = tenant.branches[0];
    const branchB = tenant.branches[1];
    const managerA = tenant.users.find((u) => u.role === "manager" && u.branchId === branchA.id)!;

    const { announcementId } = await createPublishedRequiresAck("Cobranca — fora do escopo", [branchB.id]);

    const outcome = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      remindPendingUsers(tx, tenant.tenant.id, announcementId, { branchId: managerA.branchId }, channel),
    );

    expect(outcome).toBeNull();
  });
});
