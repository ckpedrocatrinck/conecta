import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { withTenant } from "../../src/lib/db/with-tenant";
import { publishAnnouncement } from "../../src/lib/announcements/publish";
import { countPendingAcksForUser, getCachedPendingAckCount } from "../../src/lib/announcements/list-for-user";
import { createAnnouncementDraft } from "../../src/lib/repositories/announcement.repository";
import { createAnnouncementVersion } from "../../src/lib/repositories/announcement-version.repository";
import { createAnnouncementAckIdempotent } from "../../src/lib/repositories/announcement-ack.repository";

const ownerDb = new PrismaClient();

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Pending Badge Test ${suffix}`,
    slug: `pending-badge-test-${suffix}`,
    branchCount: 1,
    userCount: 4,
    cpfSeedOffset: 960,
    includeSampleAnnouncements: false,
  });
}, 60_000);

afterAll(async () => {
  await ownerDb.$executeRawUnsafe("ALTER TABLE announcement_acks DISABLE TRIGGER USER");
  try {
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

/**
 * O badge de pendencia da navegacao (INC-008.5) reusa countPendingAcksForUser
 * (INC-005) via um wrapper cache()-ado (getCachedPendingAckCount) — este
 * teste garante que o wrapper nunca diverge da contagem original, tanto
 * quando ha pendencia quanto quando ela some (ack feito).
 *
 * Usa dois usuarios distintos (um pendente, um ja com ack) em vez de
 * medir o mesmo usuario antes/depois — cache() do React e' pensado para
 * deduplicar dentro de um unico request do App Router; chamar a mesma
 * chave duas vezes fora desse contexto (como aqui, num teste puro) nao tem
 * comportamento documentado, entao o teste evita depender disso.
 */
describe("badge de pendencia da navegacao bate com countPendingAcksForUser", () => {
  it("conta o mesmo numero de pendencias para quem esta pendente e para quem ja confirmou (zero)", async () => {
    const pendingUserId = tenant.users[1].id;
    const ackedUserId = tenant.users[2].id;

    const { announcementId, versionId } = await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
      const draft = await createAnnouncementDraft(tx, {
        tenantId: tenant.tenant.id,
        category: "seguranca",
        criticality: "requires_ack",
        createdBy: tenant.users[0].id,
      });
      const version = await createAnnouncementVersion(tx, {
        tenantId: tenant.tenant.id,
        announcementId: draft.id,
        title: "Comunicado de teste do badge",
        body: "<p>corpo</p>",
        createdBy: tenant.users[0].id,
      });
      await publishAnnouncement(tx, { tenantId: tenant.tenant.id, announcementId: draft.id });
      return { announcementId: draft.id, versionId: version.id };
    });

    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createAnnouncementAckIdempotent(tx, {
        tenantId: tenant.tenant.id,
        announcementId,
        versionId,
        userId: ackedUserId,
        contentHashAtAck: "test-hash",
      }),
    );

    const [pendingDirect, pendingCached, ackedDirect, ackedCached] = await withTenant(
      { tenantId: tenant.tenant.id },
      (tx) =>
        Promise.all([
          countPendingAcksForUser(tx, tenant.tenant.id, pendingUserId),
          getCachedPendingAckCount(tenant.tenant.id, pendingUserId),
          countPendingAcksForUser(tx, tenant.tenant.id, ackedUserId),
          getCachedPendingAckCount(tenant.tenant.id, ackedUserId),
        ]),
    );

    expect(pendingDirect).toBeGreaterThan(0);
    expect(pendingCached).toBe(pendingDirect);

    expect(ackedDirect).toBe(0);
    expect(ackedCached).toBe(0);
  });
});
