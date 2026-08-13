import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { cleanupTenant } from "../helpers/cleanup-tenant";
import { withTenant } from "../../src/lib/db/with-tenant";
import { publishAnnouncement } from "../../src/lib/announcements/publish";
import { listAnnouncementsForUser } from "../../src/lib/announcements/list-for-user";
import { listAnnouncementPendencySummaries } from "../../src/lib/announcements/pending-panel";
import {
  createAnnouncementDraft,
  findAnnouncementById,
  findAnnouncementsForAdminList,
  scheduleAnnouncementPublication,
} from "../../src/lib/repositories/announcement.repository";
import { createAnnouncementVersion } from "../../src/lib/repositories/announcement-version.repository";

const ownerDb = new PrismaClient();

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Ordering Test ${suffix}`,
    slug: `ordering-test-${suffix}`,
    branchCount: 2,
    userCount: 6,
    cpfSeedOffset: 850,
    includeSampleAnnouncements: false,
  });
}, 60_000);

afterAll(async () => {
  await cleanupTenant(ownerDb, tenant.tenant.id);
  await ownerDb.$disconnect();
});

async function createDraft(title: string, criticality: "info" | "requires_ack" = "info") {
  return withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
    const draft = await createAnnouncementDraft(tx, {
      tenantId: tenant.tenant.id,
      category: "teste",
      criticality,
      createdBy: tenant.users[0].id,
    });
    await createAnnouncementVersion(tx, {
      tenantId: tenant.tenant.id,
      announcementId: draft.id,
      title,
      body: "<p>corpo</p>",
      createdBy: tenant.users[0].id,
    });
    return draft.id;
  });
}

describe("publish_at gravado na publicacao (INC-027 bloco 3.9)", () => {
  it("publicacao imediata (sem agendamento) grava publish_at = agora, nunca null", async () => {
    const draftId = await createDraft("Publicacao imediata");
    const before = Date.now();

    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      publishAnnouncement(tx, { tenantId: tenant.tenant.id, announcementId: draftId }),
    );

    const after = Date.now();
    const published = await withTenant({ tenantId: tenant.tenant.id }, (tx) => findAnnouncementById(tx, tenant.tenant.id, draftId));
    expect(published?.publishAt).not.toBeNull();
    const publishAtMs = published!.publishAt!.getTime();
    expect(publishAtMs).toBeGreaterThanOrEqual(before);
    expect(publishAtMs).toBeLessThanOrEqual(after);
  });

  it("agendado ja devido (sweep, ou 'publicar agora' apos a data marcada) preserva o publish_at do agendamento", async () => {
    const draftId = await createDraft("Agendado ja devido");
    const scheduledFor = new Date(Date.now() - 60_000);

    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      scheduleAnnouncementPublication(tx, tenant.tenant.id, draftId, scheduledFor),
    );
    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      publishAnnouncement(tx, { tenantId: tenant.tenant.id, announcementId: draftId }),
    );

    const published = await withTenant({ tenantId: tenant.tenant.id }, (tx) => findAnnouncementById(tx, tenant.tenant.id, draftId));
    expect(published?.publishAt?.getTime()).toBe(scheduledFor.getTime());
  });

  it("'publicar agora' ANTES da data agendada usa o instante real, nao a data futura obsoleta", async () => {
    const draftId = await createDraft("Publicar agora antecipando agendamento");
    const scheduledForFuture = new Date(Date.now() + 60 * 60_000);

    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      scheduleAnnouncementPublication(tx, tenant.tenant.id, draftId, scheduledForFuture),
    );
    const before = Date.now();
    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      publishAnnouncement(tx, { tenantId: tenant.tenant.id, announcementId: draftId }),
    );
    const after = Date.now();

    const published = await withTenant({ tenantId: tenant.tenant.id }, (tx) => findAnnouncementById(tx, tenant.tenant.id, draftId));
    const publishAtMs = published!.publishAt!.getTime();
    // Se a antecipacao nao fosse tratada, publishAt ficaria com o valor futuro
    // obsoleto (scheduledForFuture) — a lista ordenaria por uma data que ainda
    // nao chegou em vez do instante em que o conteudo de fato ficou visivel.
    expect(publishAtMs).not.toBe(scheduledForFuture.getTime());
    expect(publishAtMs).toBeGreaterThanOrEqual(before);
    expect(publishAtMs).toBeLessThanOrEqual(after);
  });
});

describe("ordenacao: mais recente primeiro, mesmo com agendamento (INC-027 bloco 3.9)", () => {
  it("comunicado agendado publicado DEPOIS de outro criado ANTES aparece primeiro em toda lista", async () => {
    // A e' criado primeiro (created_at menor) mas so' fica visivel (publish_at)
    // DEPOIS de B, que e' criado depois porem publicado de imediato. Ordenar
    // por created_at (o bug) colocaria B acima de A; o campo certo (publish_at)
    // exige o oposto.
    const announcementAId = await createDraft("A — criado antes, publicado depois", "requires_ack");
    const announcementBId = await createDraft("B — criado depois, publicado antes", "requires_ack");

    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      publishAnnouncement(tx, { tenantId: tenant.tenant.id, announcementId: announcementBId }),
    );
    const bState = await withTenant({ tenantId: tenant.tenant.id }, (tx) => findAnnouncementById(tx, tenant.tenant.id, announcementBId));

    // A e' agendado para um instante certamente posterior ao publish_at real de B.
    const aScheduledFor = new Date(bState!.publishAt!.getTime() + 60_000);
    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      scheduleAnnouncementPublication(tx, tenant.tenant.id, announcementAId, aScheduledFor),
    );
    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      publishAnnouncement(tx, { tenantId: tenant.tenant.id, announcementId: announcementAId }),
    );

    const aState = await withTenant({ tenantId: tenant.tenant.id }, (tx) => findAnnouncementById(tx, tenant.tenant.id, announcementAId));
    expect(aState!.createdAt.getTime()).toBeLessThan(bState!.createdAt.getTime());
    expect(aState!.publishAt!.getTime()).toBeGreaterThan(bState!.publishAt!.getTime());

    const adminList = await withTenant({ tenantId: tenant.tenant.id }, (tx) => findAnnouncementsForAdminList(tx, tenant.tenant.id));
    const adminOrder = adminList.filter((a) => a.id === announcementAId || a.id === announcementBId).map((a) => a.id);
    expect(adminOrder).toEqual([announcementAId, announcementBId]);

    const colaborador = tenant.users.find((u) => u.role === "employee")!;
    const { items } = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      listAnnouncementsForUser(tx, tenant.tenant.id, colaborador.id),
    );
    const colaboradorOrder = items
      .filter((i) => i.announcement.id === announcementAId || i.announcement.id === announcementBId)
      .map((i) => i.announcement.id);
    expect(colaboradorOrder).toEqual([announcementAId, announcementBId]);

    const summaries = await withTenant({ tenantId: tenant.tenant.id }, (tx) => listAnnouncementPendencySummaries(tx, tenant.tenant.id));
    const summaryOrder = summaries
      .filter((s) => s.announcement.id === announcementAId || s.announcement.id === announcementBId)
      .map((s) => s.announcement.id);
    expect(summaryOrder).toEqual([announcementAId, announcementBId]);
  });
});
