import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { cleanupTenant } from "../helpers/cleanup-tenant";
import { withTenant } from "../../src/lib/db/with-tenant";
import { publishAnnouncement } from "../../src/lib/announcements/publish";
import {
  getAnnouncementPendencyDetail,
  getUserPendencyHistory,
  listAnnouncementPendencySummaries,
} from "../../src/lib/announcements/pending-panel";
import { archiveAnnouncement, createAnnouncementDraft } from "../../src/lib/repositories/announcement.repository";
import { createAnnouncementVersion } from "../../src/lib/repositories/announcement-version.repository";
import { replaceAnnouncementAudience } from "../../src/lib/repositories/announcement-audience.repository";
import { createAnnouncementAckIdempotent } from "../../src/lib/repositories/announcement-ack.repository";
import { setEmployeeStatus } from "../../src/lib/repositories/user.repository";

const ownerDb = new PrismaClient();

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Pending Panel Test ${suffix}`,
    slug: `pending-panel-test-${suffix}`,
    branchCount: 2,
    userCount: 10,
    cpfSeedOffset: 950,
    includeSampleAnnouncements: false,
  });
}, 60_000);

afterAll(async () => {
  await cleanupTenant(ownerDb, tenant.tenant.id);
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

describe("denominador de pendencia: filial + desligado", () => {
  it("desligado sai do denominador mas seu ack historico continua gravado", async () => {
    const branchA = tenant.branches[0];
    // Publico-alvo e' por FILIAL, nao por papel — inclui qualquer usuario
    // ativo de branchA (admin/manager/employee), nao so' colaboradores.
    const activeInA = tenant.users.filter((u) => u.branchId === branchA.id && u.status === "active");
    expect(activeInA.length).toBeGreaterThanOrEqual(3);
    const [empAcked, empAckedThenFired] = activeInA;
    const totalBefore = activeInA.length;

    const { announcementId, versionId } = await createPublishedRequiresAck("So filial A — denominador", [branchA.id]);
    await ackAs(empAcked.id, announcementId, versionId);
    await ackAs(empAckedThenFired.id, announcementId, versionId);

    const beforeFire = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      getAnnouncementPendencyDetail(tx, tenant.tenant.id, announcementId),
    );
    expect(beforeFire?.confirmed.length).toBe(2);
    expect(beforeFire?.pending.length).toBe(totalBefore - 2);
    expect(beforeFire?.confirmed.map((u) => u.id).sort()).toEqual([empAcked.id, empAckedThenFired.id].sort());

    await withTenant({ tenantId: tenant.tenant.id }, (tx) => setEmployeeStatus(tx, tenant.tenant.id, empAckedThenFired.id, "inactive"));

    const afterFire = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      getAnnouncementPendencyDetail(tx, tenant.tenant.id, announcementId),
    );
    // Denominador cai em 1 (empAckedThenFired sai); confirmados = so' empAcked.
    expect(afterFire?.confirmed.length).toBe(1);
    expect(afterFire?.confirmed[0].id).toBe(empAcked.id);
    expect((afterFire?.pending.length ?? 0) + (afterFire?.confirmed.length ?? 0)).toBe(totalBefore - 1);
    expect(afterFire?.pending.some((u) => u.id === empAckedThenFired.id)).toBe(false);

    // O ack historico do desligado continua no banco (imutavel), so' nao
    // conta mais no denominador ativo.
    const historicalAck = await ownerDb.announcementAck.findFirst({
      where: { announcementId, userId: empAckedThenFired.id },
    });
    expect(historicalAck).not.toBeNull();
  });
});

describe("consistencia com reabertura por versao material (INC-005)", () => {
  it("ack em V1 nao satisfaz mais depois de V3 material — aparece como pendente no painel", async () => {
    const branchA = tenant.branches[0];
    const emp = tenant.users.find((u) => u.branchId === branchA.id && u.role === "employee")!;

    const { announcementId, versionId: v1Id } = await createPublishedRequiresAck("Reabertura — painel", [branchA.id]);
    await ackAs(emp.id, announcementId, v1Id);

    let detail = await withTenant({ tenantId: tenant.tenant.id }, (tx) => getAnnouncementPendencyDetail(tx, tenant.tenant.id, announcementId));
    expect(detail?.confirmed.some((u) => u.id === emp.id)).toBe(true);

    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createAnnouncementVersion(tx, {
        tenantId: tenant.tenant.id,
        announcementId,
        title: "Reabertura — painel — V3 material",
        body: "<p>mudanca material</p>",
        createdBy: tenant.users[0].id,
        isMaterialChange: true,
      }),
    );

    detail = await withTenant({ tenantId: tenant.tenant.id }, (tx) => getAnnouncementPendencyDetail(tx, tenant.tenant.id, announcementId));
    expect(detail?.confirmed.some((u) => u.id === emp.id)).toBe(false);
    expect(detail?.pending.some((u) => u.id === emp.id)).toBe(true);
    expect(detail?.requiredVersionNumber).toBe(2);
  });
});

describe("isolamento de gestor por filial", () => {
  it("manager da filial A nao enxerga comunicado restrito a filial B nem colaborador de B", async () => {
    const branchA = tenant.branches[0];
    const branchB = tenant.branches[1];
    const managerA = tenant.users.find((u) => u.role === "manager" && u.branchId === branchA.id)!;
    const empInB = tenant.users.find((u) => u.role === "employee" && u.branchId === branchB.id)!;
    const empInA = tenant.users.find((u) => u.role === "employee" && u.branchId === branchA.id)!;

    const onlyB = await createPublishedRequiresAck("So filial B — isolamento", [branchB.id]);
    const onlyA = await createPublishedRequiresAck("So filial A — isolamento", [branchA.id]);

    const detailB = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      getAnnouncementPendencyDetail(tx, tenant.tenant.id, onlyB.announcementId, { branchId: managerA.branchId }),
    );
    expect(detailB).toBeNull();

    const detailA = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      getAnnouncementPendencyDetail(tx, tenant.tenant.id, onlyA.announcementId, { branchId: managerA.branchId }),
    );
    expect(detailA).not.toBeNull();

    const summaries = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      listAnnouncementPendencySummaries(tx, tenant.tenant.id, { branchId: managerA.branchId }),
    );
    expect(summaries.some((s) => s.announcement.id === onlyB.announcementId)).toBe(false);
    expect(summaries.some((s) => s.announcement.id === onlyA.announcementId)).toBe(true);

    const historyOfB = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      getUserPendencyHistory(tx, tenant.tenant.id, empInB.id, { branchId: managerA.branchId }),
    );
    expect(historyOfB).toBeNull();

    const historyOfA = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      getUserPendencyHistory(tx, tenant.tenant.id, empInA.id, { branchId: managerA.branchId }),
    );
    expect(historyOfA).not.toBeNull();
  });
});

describe("DP-11 — arquivado com pendencia nao resolvida", () => {
  it("comunicado requires_ack arquivado com publico-alvo ativo sem ack e' sinalizado", async () => {
    const branchA = tenant.branches[0];
    const { announcementId } = await createPublishedRequiresAck("Arquivado com pendencia — DP-11", [branchA.id]);

    await withTenant({ tenantId: tenant.tenant.id }, (tx) => archiveAnnouncement(tx, tenant.tenant.id, announcementId));

    const detail = await withTenant({ tenantId: tenant.tenant.id }, (tx) => getAnnouncementPendencyDetail(tx, tenant.tenant.id, announcementId));
    expect(detail?.pending.length).toBeGreaterThan(0);

    const summaries = await withTenant({ tenantId: tenant.tenant.id }, (tx) => listAnnouncementPendencySummaries(tx, tenant.tenant.id));
    const summary = summaries.find((s) => s.announcement.id === announcementId);
    expect(summary?.isArchivedWithPendency).toBe(true);
  });
});
