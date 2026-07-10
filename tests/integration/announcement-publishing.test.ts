import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { withTenant } from "../../src/lib/db/with-tenant";
import { publishAnnouncement, formatAnnouncementCode } from "../../src/lib/announcements/publish";
import { runScheduledAnnouncementSweep } from "../../src/lib/announcements/scheduled-sweep";
import {
  createAnnouncementDraft,
  findAnnouncementById,
  findVisibleAnnouncementIdsForUser,
} from "../../src/lib/repositories/announcement.repository";
import { createAnnouncementVersion, findAnnouncementVersionHistory } from "../../src/lib/repositories/announcement-version.repository";
import { replaceAnnouncementAudience } from "../../src/lib/repositories/announcement-audience.repository";

const ownerDb = new PrismaClient();

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  // Senha da role conecta_app e' garantida uma unica vez pelo globalSetup do
  // vitest — ver comentario equivalente em tenant-isolation.test.ts.
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Announcements Test ${suffix}`,
    slug: `announcements-test-${suffix}`,
    branchCount: 2,
    userCount: 6,
    cpfSeedOffset: 500,
    // Sem comunicados de exemplo: este arquivo testa a numeracao do zero —
    // com a amostra padrao (seq 1..3 no ano atual), a primeira chamada real
    // de nextAnnouncementSequenceNumber colidiria com a unique constraint
    // (tenantId, year, seqNumber). Bonus: sem acks de exemplo, a limpeza
    // abaixo nao precisa desabilitar o trigger de imutabilidade — menos
    // superficie pra corrida com outros arquivos de teste que fazem o mesmo
    // ALTER TABLE (global, nao escopado a conexao) em paralelo.
    includeSampleAnnouncements: false,
  });
}, 60_000);

afterAll(async () => {
  await ownerDb.announcementSequence.deleteMany({ where: { tenantId: tenant.tenant.id } });
  await ownerDb.announcement.deleteMany({ where: { tenantId: tenant.tenant.id } });
  await ownerDb.post.deleteMany({ where: { tenantId: tenant.tenant.id } });
  await ownerDb.jobOpening.deleteMany({ where: { tenantId: tenant.tenant.id } });
  await ownerDb.user.deleteMany({ where: { tenantId: tenant.tenant.id } });
  await ownerDb.tenant.deleteMany({ where: { id: tenant.tenant.id } });
  await ownerDb.$disconnect();
});

async function createDraft(title: string) {
  return withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
    const draft = await createAnnouncementDraft(tx, {
      tenantId: tenant.tenant.id,
      category: "teste",
      criticality: "info",
      createdBy: tenant.users[0].id,
    });
    await createAnnouncementVersion(tx, {
      tenantId: tenant.tenant.id,
      announcementId: draft.id,
      title,
      body: "<p>corpo original</p>",
      createdBy: tenant.users[0].id,
    });
    return draft.id;
  });
}

describe("numeracao CI NN/AAAA — a prova de corrida", () => {
  it("N publicacoes concorrentes de rascunhos DISTINTOS recebem numeros unicos, sem duplicata", async () => {
    const COUNT = 12;
    const draftIds = await Promise.all(Array.from({ length: COUNT }, (_, i) => createDraft(`Concorrencia ${i}`)));

    const outcomes = await Promise.all(
      draftIds.map((id) =>
        withTenant({ tenantId: tenant.tenant.id }, (tx) =>
          publishAnnouncement(tx, { tenantId: tenant.tenant.id, announcementId: id }),
        ),
      ),
    );

    expect(outcomes.every((o) => o.status === "published")).toBe(true);
    const seqNumbers = outcomes.map((o) => (o.status === "published" ? o.seqNumber : -1));
    expect(new Set(seqNumbers).size).toBe(COUNT);
  });

  it("dois admins publicando o MESMO rascunho ao mesmo tempo: so' um consome numero, nenhum duplica", async () => {
    const draftId = await createDraft("Mesmo rascunho, corrida");

    const outcomes = await Promise.all([
      withTenant({ tenantId: tenant.tenant.id }, (tx) => publishAnnouncement(tx, { tenantId: tenant.tenant.id, announcementId: draftId })),
      withTenant({ tenantId: tenant.tenant.id }, (tx) => publishAnnouncement(tx, { tenantId: tenant.tenant.id, announcementId: draftId })),
    ]);

    const published = outcomes.filter((o) => o.status === "published");
    const skipped = outcomes.filter((o) => o.status === "skipped");
    expect(published.length).toBe(1);
    expect(skipped.length).toBe(1);

    const final = await withTenant({ tenantId: tenant.tenant.id }, (tx) => findAnnouncementById(tx, tenant.tenant.id, draftId));
    expect(final?.status).toBe("published");
    expect(final?.seqNumber).toBe((published[0] as { status: "published"; seqNumber: number }).seqNumber);
  });

  it("formatAnnouncementCode produz CI NN/AAAA com NN preenchido com zero", () => {
    expect(formatAnnouncementCode(1, 2026)).toBe("CI 01/2026");
    expect(formatAnnouncementCode(23, 2026)).toBe("CI 23/2026");
    expect(formatAnnouncementCode(123, 2026)).toBe("CI 123/2026");
  });
});

describe("rascunho nao consome numero", () => {
  it("salvar um rascunho varias vezes (varias versoes) nao atribui seq_number/year", async () => {
    const draftId = await createDraft("Rascunho multi-save");

    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createAnnouncementVersion(tx, {
        tenantId: tenant.tenant.id,
        announcementId: draftId,
        title: "Rascunho multi-save (editado)",
        body: "<p>corpo editado ainda em rascunho</p>",
        createdBy: tenant.users[0].id,
      }),
    );

    const draft = await withTenant({ tenantId: tenant.tenant.id }, (tx) => findAnnouncementById(tx, tenant.tenant.id, draftId));
    expect(draft?.status).toBe("draft");
    expect(draft?.seqNumber).toBeNull();
    expect(draft?.year).toBeNull();

    const history = await withTenant({ tenantId: tenant.tenant.id }, (tx) => findAnnouncementVersionHistory(tx, draftId));
    expect(history.length).toBe(2);
  });
});

describe("versionamento imutavel", () => {
  it("editar um comunicado publicado gera versao nova; hash muda; a versao antiga permanece intacta", async () => {
    const draftId = await createDraft("Comunicado versionado");
    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      publishAnnouncement(tx, { tenantId: tenant.tenant.id, announcementId: draftId }),
    );

    const versionsBeforeEdit = await withTenant({ tenantId: tenant.tenant.id }, (tx) => findAnnouncementVersionHistory(tx, draftId));
    expect(versionsBeforeEdit.length).toBe(1);
    const originalVersion = versionsBeforeEdit[0];

    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createAnnouncementVersion(tx, {
        tenantId: tenant.tenant.id,
        announcementId: draftId,
        title: "Comunicado versionado — corrigido",
        body: "<p>corpo corrigido apos publicacao</p>",
        createdBy: tenant.users[0].id,
        isMaterialChange: true,
      }),
    );

    const versionsAfterEdit = await withTenant({ tenantId: tenant.tenant.id }, (tx) => findAnnouncementVersionHistory(tx, draftId));
    expect(versionsAfterEdit.length).toBe(2);

    const newVersion = versionsAfterEdit.find((v) => v.versionNumber === 2);
    const untouchedOriginal = versionsAfterEdit.find((v) => v.versionNumber === 1);

    expect(newVersion?.contentHash).not.toBe(originalVersion.contentHash);
    expect(newVersion?.isMaterialChange).toBe(true);

    // versao antiga permanece integra: mesmo id, titulo, corpo e hash de antes.
    expect(untouchedOriginal?.id).toBe(originalVersion.id);
    expect(untouchedOriginal?.title).toBe(originalVersion.title);
    expect(untouchedOriginal?.body).toBe(originalVersion.body);
    expect(untouchedOriginal?.contentHash).toBe(originalVersion.contentHash);
    expect(untouchedOriginal?.isMaterialChange).toBe(false);
  });
});

describe("publico-alvo por filial restringe visibilidade", () => {
  it("audiencia com 1 filial: usuario dessa filial ve, usuario de outra filial nao ve", async () => {
    const [branchA, branchB] = tenant.branches;
    const userInBranchA = tenant.users.find((u) => u.branchId === branchA.id)!;
    const userInBranchB = tenant.users.find((u) => u.branchId === branchB.id)!;

    const draftId = await createDraft("So' filial A");
    await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
      await replaceAnnouncementAudience(tx, tenant.tenant.id, draftId, [branchA.id]);
      await publishAnnouncement(tx, { tenantId: tenant.tenant.id, announcementId: draftId });
    });

    const visibleToA = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findVisibleAnnouncementIdsForUser(tx, tenant.tenant.id, userInBranchA.id),
    );
    const visibleToB = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findVisibleAnnouncementIdsForUser(tx, tenant.tenant.id, userInBranchB.id),
    );

    expect(visibleToA).toContain(draftId);
    expect(visibleToB).not.toContain(draftId);
  });

  it("audiencia vazia (todos): visivel para usuarios de qualquer filial", async () => {
    const [branchA, branchB] = tenant.branches;
    const userInBranchA = tenant.users.find((u) => u.branchId === branchA.id)!;
    const userInBranchB = tenant.users.find((u) => u.branchId === branchB.id)!;

    const draftId = await createDraft("Para todos");
    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      publishAnnouncement(tx, { tenantId: tenant.tenant.id, announcementId: draftId }),
    );

    const visibleToA = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findVisibleAnnouncementIdsForUser(tx, tenant.tenant.id, userInBranchA.id),
    );
    const visibleToB = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findVisibleAnnouncementIdsForUser(tx, tenant.tenant.id, userInBranchB.id),
    );

    expect(visibleToA).toContain(draftId);
    expect(visibleToB).toContain(draftId);
  });
});

describe("agendamento via cron (sweep)", () => {
  it("scheduled com publishAt no passado e' publicado pelo sweep; no futuro nao e' tocado", async () => {
    const pastDraftId = await createDraft("Agendado no passado");
    const futureDraftId = await createDraft("Agendado no futuro");

    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      tx.announcement.updateMany({
        where: { id: pastDraftId },
        data: { status: "scheduled", publishAt: new Date(Date.now() - 60_000) },
      }),
    );
    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      tx.announcement.updateMany({
        where: { id: futureDraftId },
        data: { status: "scheduled", publishAt: new Date(Date.now() + 60 * 60_000) },
      }),
    );

    const result = await runScheduledAnnouncementSweep();
    expect(result.published.some((p) => p.announcementId === pastDraftId)).toBe(true);
    expect(result.published.some((p) => p.announcementId === futureDraftId)).toBe(false);

    const pastState = await withTenant({ tenantId: tenant.tenant.id }, (tx) => findAnnouncementById(tx, tenant.tenant.id, pastDraftId));
    const futureState = await withTenant({ tenantId: tenant.tenant.id }, (tx) => findAnnouncementById(tx, tenant.tenant.id, futureDraftId));
    expect(pastState?.status).toBe("published");
    expect(pastState?.seqNumber).not.toBeNull();
    expect(futureState?.status).toBe("scheduled");
    expect(futureState?.seqNumber).toBeNull();
  });
});
