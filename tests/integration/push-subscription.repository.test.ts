import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { withTenant } from "../../src/lib/db/with-tenant";
import {
  deletePushSubscriptionById,
  findPushSubscriptionsForUser,
  savePushSubscription,
} from "../../src/lib/repositories/push-subscription.repository";

const ownerDb = new PrismaClient();

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;
let otherTenant: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Push Subscription Test ${suffix}`,
    slug: `push-subscription-test-${suffix}`,
    branchCount: 1,
    userCount: 4,
    cpfSeedOffset: 970,
    includeSampleAnnouncements: false,
  });
  otherTenant = await buildTenantFixtures(ownerDb, {
    name: `Push Subscription Test Other ${suffix}`,
    slug: `push-subscription-test-other-${suffix}`,
    branchCount: 1,
    userCount: 4,
    cpfSeedOffset: 975,
    includeSampleAnnouncements: false,
  });
}, 60_000);

afterAll(async () => {
  for (const t of [tenant, otherTenant]) {
    await ownerDb.pushSubscription.deleteMany({ where: { tenantId: t.tenant.id } });
    await ownerDb.post.deleteMany({ where: { tenantId: t.tenant.id } });
    await ownerDb.jobOpening.deleteMany({ where: { tenantId: t.tenant.id } });
    await ownerDb.benefit.deleteMany({ where: { tenantId: t.tenant.id } });
    await ownerDb.user.deleteMany({ where: { tenantId: t.tenant.id } });
    await ownerDb.tenant.deleteMany({ where: { id: t.tenant.id } });
  }
  await ownerDb.$disconnect();
});

describe("push-subscription.repository", () => {
  it("salva a subscription associada ao tenant e ao usuario certos", async () => {
    const user = tenant.users[0];

    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      savePushSubscription(tx, {
        tenantId: tenant.tenant.id,
        userId: user.id,
        endpoint: "https://push.example/endpoint-1",
        keys: { p256dh: "p256dh-1", auth: "auth-1" },
      }),
    );

    const saved = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findPushSubscriptionsForUser(tx, tenant.tenant.id, user.id),
    );

    expect(saved).toHaveLength(1);
    expect(saved[0].tenantId).toBe(tenant.tenant.id);
    expect(saved[0].userId).toBe(user.id);
    expect(saved[0].endpoint).toBe("https://push.example/endpoint-1");
  });

  it("resubscrever o mesmo endpoint nao duplica (sem UPDATE no GRANT, e' no-op)", async () => {
    const user = tenant.users[1];
    const input = {
      tenantId: tenant.tenant.id,
      userId: user.id,
      endpoint: "https://push.example/endpoint-2",
      keys: { p256dh: "p256dh-2", auth: "auth-2" },
    };

    await withTenant({ tenantId: tenant.tenant.id }, (tx) => savePushSubscription(tx, input));
    await withTenant({ tenantId: tenant.tenant.id }, (tx) => savePushSubscription(tx, input));

    const saved = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findPushSubscriptionsForUser(tx, tenant.tenant.id, user.id),
    );

    expect(saved).toHaveLength(1);
  });

  it("apagar e' escopado: tenant/usuario errado nao remove a subscription de outro", async () => {
    const owner = tenant.users[0];
    const intruder = otherTenant.users[0];

    const created = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      savePushSubscription(tx, {
        tenantId: tenant.tenant.id,
        userId: owner.id,
        endpoint: "https://push.example/endpoint-3",
        keys: { p256dh: "p256dh-3", auth: "auth-3" },
      }),
    );

    // Tenta apagar com o tenant/usuario errado (RLS ja impediria o SELECT
    // funcionar entre tenants, mas o WHERE explicito e' a segunda camada).
    await withTenant({ tenantId: otherTenant.tenant.id }, (tx) =>
      deletePushSubscriptionById(tx, otherTenant.tenant.id, intruder.id, created.id),
    );

    const stillThere = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findPushSubscriptionsForUser(tx, tenant.tenant.id, owner.id),
    );
    expect(stillThere.some((s) => s.id === created.id)).toBe(true);

    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      deletePushSubscriptionById(tx, tenant.tenant.id, owner.id, created.id),
    );

    const afterDelete = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findPushSubscriptionsForUser(tx, tenant.tenant.id, owner.id),
    );
    expect(afterDelete.some((s) => s.id === created.id)).toBe(false);
  });
});
