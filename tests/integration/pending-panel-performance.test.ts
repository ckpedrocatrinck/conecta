import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { withTenant } from "../../src/lib/db/with-tenant";
import { computeContentHash } from "../../src/lib/crypto/content-hash";
import { listAnnouncementPendencySummaries } from "../../src/lib/announcements/pending-panel";
import type { AnnouncementStatus } from "@prisma/client";

const ownerDb = new PrismaClient();

const USER_COUNT = 500;
const BRANCH_COUNT = 5;
const ANNOUNCEMENT_COUNT = 100;

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;

/**
 * Insercao em lote (createMany), fora do fluxo normal de publicacao — o
 * objetivo aqui e' montar volume rapido para o criterio de performance
 * (500 usuarios x 100 comunicados < 1s), nao exercitar publishAnnouncement.
 * IDs gerados no cliente (randomUUID) para poder referenciar
 * announcement<->version<->ack sem round-trip de leitura entre os creates.
 */
async function seedRequiresAckAnnouncements() {
  const admin = tenant.users[0];
  const activeUsers = tenant.users.filter((u) => u.status === "active");

  const announcements = Array.from({ length: ANNOUNCEMENT_COUNT }, (_, i) => ({
    id: randomUUID(),
    isArchived: i % 4 === 0, // 25% arquivados
    isRestricted: i % 2 === 0, // 50% restritos a 1 filial
    branchId: tenant.branches[i % BRANCH_COUNT].id,
  }));

  await ownerDb.announcement.createMany({
    data: announcements.map((a) => ({
      id: a.id,
      tenantId: tenant.tenant.id,
      category: "seguranca",
      criticality: "requires_ack" as const,
      status: (a.isArchived ? "archived" : "published") satisfies AnnouncementStatus as AnnouncementStatus,
      publishAt: new Date(),
      createdBy: admin.id,
    })),
  });

  const versions = announcements.map((a) => {
    const title = `Comunicado de performance ${a.id}`;
    const body = "<p>corpo de teste de performance</p>";
    return {
      id: randomUUID(),
      tenantId: tenant.tenant.id,
      announcementId: a.id,
      versionNumber: 1,
      title,
      body,
      contentHash: computeContentHash(title, body),
      createdBy: admin.id,
    };
  });
  await ownerDb.announcementVersion.createMany({ data: versions });

  await ownerDb.announcementAudience.createMany({
    data: announcements.filter((a) => a.isRestricted).map((a) => ({ announcementId: a.id, branchId: a.branchId, tenantId: tenant.tenant.id })),
  });

  const versionByAnnouncementId = new Map(versions.map((v) => [v.announcementId, v]));
  const ackRows: { tenantId: string; announcementId: string; versionId: string; userId: string; contentHashAtAck: string }[] = [];
  for (const a of announcements) {
    const version = versionByAnnouncementId.get(a.id)!;
    const targetUsers = a.isRestricted ? activeUsers.filter((u) => u.branchId === a.branchId) : activeUsers;
    // Aproximadamente metade do publico-alvo confirma.
    for (let i = 0; i < targetUsers.length; i += 2) {
      ackRows.push({
        tenantId: tenant.tenant.id,
        announcementId: a.id,
        versionId: version.id,
        userId: targetUsers[i].id,
        contentHashAtAck: version.contentHash,
      });
    }
  }
  for (let i = 0; i < ackRows.length; i += 2000) {
    await ownerDb.announcementAck.createMany({ data: ackRows.slice(i, i + 2000) });
  }
}

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Pending Panel Perf Test ${suffix}`,
    slug: `pending-panel-perf-test-${suffix}`,
    branchCount: BRANCH_COUNT,
    userCount: USER_COUNT,
    cpfSeedOffset: 999,
    includeSampleAnnouncements: false,
  });
  await seedRequiresAckAnnouncements();
}, 300_000);

afterAll(async () => {
  await ownerDb.$executeRawUnsafe("ALTER TABLE announcement_acks DISABLE TRIGGER USER");
  try {
    await ownerDb.announcementAck.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.announcementVersion.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.announcementAudience.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.announcement.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.postReaction.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.postMedia.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.postPerson.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.post.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.jobApplication.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.jobOpening.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.user.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.branch.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.tenant.deleteMany({ where: { id: tenant.tenant.id } });
  } finally {
    await ownerDb.$executeRawUnsafe("ALTER TABLE announcement_acks ENABLE TRIGGER USER");
  }
  await ownerDb.$disconnect();
}, 60_000);

describe("performance do painel de pendencias", () => {
  it(`agrega ${USER_COUNT} usuarios x ${ANNOUNCEMENT_COUNT} comunicados em menos de 1s`, async () => {
    const start = performance.now();
    const summaries = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      listAnnouncementPendencySummaries(tx, tenant.tenant.id),
    );
    const durationMs = performance.now() - start;
    console.log(`listAnnouncementPendencySummaries: ${durationMs.toFixed(1)}ms para ${USER_COUNT}x${ANNOUNCEMENT_COUNT}`);

    expect(summaries.length).toBe(ANNOUNCEMENT_COUNT);
    expect(durationMs).toBeLessThan(1000);
  }, 30_000);
});
