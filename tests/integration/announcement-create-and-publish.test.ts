import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { cleanupTenant } from "../helpers/cleanup-tenant";
import { withTenant } from "../../src/lib/db/with-tenant";
import {
  createAndPublishAnnouncement,
  createAndScheduleAnnouncement,
  type NewAnnouncementInput,
} from "../../src/lib/announcements/create-with-publication";
import { runScheduledAnnouncementSweep } from "../../src/lib/announcements/scheduled-sweep";
import {
  createAnnouncementDraft,
  findAnnouncementById,
} from "../../src/lib/repositories/announcement.repository";
import {
  createAnnouncementVersion,
  findAnnouncementVersionHistory,
} from "../../src/lib/repositories/announcement-version.repository";
import { findAnnouncementAudienceBranchIds } from "../../src/lib/repositories/announcement-audience.repository";

const ownerDb = new PrismaClient();

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  // Mesmo racional de announcement-publishing.test.ts: sem comunicados de
  // exemplo, porque este arquivo testa a numeracao do zero (a amostra padrao
  // ocuparia seq 1..3 e colidiria com a unique (tenantId, year, seqNumber)).
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Create And Publish ${suffix}`,
    slug: `create-and-publish-${suffix}`,
    branchCount: 2,
    userCount: 4,
    cpfSeedOffset: 900,
    includeSampleAnnouncements: false,
  });
}, 60_000);

afterAll(async () => {
  await cleanupTenant(ownerDb, tenant.tenant.id);
  await ownerDb.$disconnect();
});

function input(overrides: Partial<NewAnnouncementInput> = {}): NewAnnouncementInput {
  return {
    tenantId: tenant.tenant.id,
    createdBy: tenant.users[0].id,
    title: "Comunicado criado e publicado num passo",
    body: "<p>corpo do comunicado</p>",
    category: "RH",
    criticality: "info",
    branchIds: [],
    ...overrides,
  };
}

describe("INC-018 — publicar agora a partir da tela de criacao", () => {
  it("nasce published com CI real, exatamente 1 versao, sem passar pela tela [id]", async () => {
    const result = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createAndPublishAnnouncement(tx, input({ title: "Publicado direto da criacao" })),
    );

    expect(result.seqNumber).toBeGreaterThan(0);
    expect(result.year).toBe(new Date().getFullYear());

    const announcement = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findAnnouncementById(tx, tenant.tenant.id, result.announcementId),
    );
    expect(announcement?.status).toBe("published");
    expect(announcement?.seqNumber).toBe(result.seqNumber);
    expect(announcement?.year).toBe(result.year);
    expect(announcement?.publishAt).toBeNull();

    const history = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findAnnouncementVersionHistory(tx, result.announcementId),
    );
    expect(history.length).toBe(1);
    expect(history[0].versionNumber).toBe(1);
    expect(history[0].title).toBe("Publicado direto da criacao");
    expect(history[0].isMaterialChange).toBe(false);
  });

  it("o corpo e' sanitizado e o publico-alvo por filial e' gravado no mesmo passo", async () => {
    const [branchA] = tenant.branches;

    const result = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createAndPublishAnnouncement(
        tx,
        input({
          title: "Com filial e HTML sujo",
          body: '<p>ok</p><script>alert(1)</script><img src="x">',
          branchIds: [branchA.id],
        }),
      ),
    );

    const [history, audience] = await withTenant({ tenantId: tenant.tenant.id }, async (tx) => [
      await findAnnouncementVersionHistory(tx, result.announcementId),
      await findAnnouncementAudienceBranchIds(tx, result.announcementId),
    ]);

    expect(history[0].body).toBe("<p>ok</p>");
    expect(audience.map((a) => a.branchId)).toEqual([branchA.id]);
  });

  it("dois admins publicando comunicados NOVOS ao mesmo tempo recebem numeros distintos", async () => {
    const COUNT = 4;

    const results = await Promise.all(
      Array.from({ length: COUNT }, (_, i) =>
        withTenant({ tenantId: tenant.tenant.id }, (tx) =>
          createAndPublishAnnouncement(tx, input({ title: `Concorrencia na criacao ${i}` })),
        ),
      ),
    );

    const seqNumbers = results.map((r) => r.seqNumber);
    expect(new Set(seqNumbers).size).toBe(COUNT);
  });
});

describe("INC-018 — agendar a partir da tela de criacao", () => {
  it("nasce scheduled com publish_at em UTC e SEM numero; o sweep publica depois", async () => {
    // No futuro na criacao (o que a Server Action exige) e no passado quando o
    // sweep roda — por isso o teste move a data pra tras antes de varrer, em
    // vez de agendar no passado (isso e' erro do usuario no INC-018 item 5).
    const publishAt = new Date(Date.now() + 60 * 60_000);

    const { announcementId } = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createAndScheduleAnnouncement(tx, input({ title: "Agendado direto da criacao" }), publishAt),
    );

    const scheduled = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findAnnouncementById(tx, tenant.tenant.id, announcementId),
    );
    expect(scheduled?.status).toBe("scheduled");
    expect(scheduled?.seqNumber).toBeNull();
    expect(scheduled?.year).toBeNull();
    // Prisma devolve Date em UTC — a igualdade de instante e' o que importa.
    expect(scheduled?.publishAt?.toISOString()).toBe(publishAt.toISOString());

    const history = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findAnnouncementVersionHistory(tx, announcementId),
    );
    expect(history.length).toBe(1);

    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      tx.announcement.updateMany({ where: { id: announcementId }, data: { publishAt: new Date(Date.now() - 60_000) } }),
    );

    const sweep = await runScheduledAnnouncementSweep();
    expect(sweep.published.some((p) => p.announcementId === announcementId)).toBe(true);

    const published = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findAnnouncementById(tx, tenant.tenant.id, announcementId),
    );
    expect(published?.status).toBe("published");
    expect(published?.seqNumber).not.toBeNull();
  });
});

describe("INC-018 — invariante sem rascunho orfao", () => {
  it("falha DEPOIS da publicacao, na mesma transacao, nao deixa comunicado nenhum atras", async () => {
    let announcementId = "";
    const countBefore = await ownerDb.announcement.count({ where: { tenantId: tenant.tenant.id } });

    await expect(
      withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
        const result = await createAndPublishAnnouncement(tx, input({ title: "Vai sumir no rollback" }));
        announcementId = result.announcementId;
        // Simula o que uma falha de infra faria logo depois de publicar.
        throw new Error("falha simulada apos a publicacao");
      }),
    ).rejects.toThrow("falha simulada apos a publicacao");

    expect(announcementId).not.toBe("");

    // Nem comunicado publicado, nem rascunho orfao: a linha nunca existiu
    // fora da transacao revertida.
    const orphan = await ownerDb.announcement.findFirst({ where: { id: announcementId } });
    expect(orphan).toBeNull();
    const versions = await ownerDb.announcementVersion.count({ where: { announcementId } });
    expect(versions).toBe(0);
    const countAfter = await ownerDb.announcement.count({ where: { tenantId: tenant.tenant.id } });
    expect(countAfter).toBe(countBefore);
  });

  it("falha no agendamento (publico-alvo invalido) reverte o rascunho recem-criado", async () => {
    const countBefore = await ownerDb.announcement.count({ where: { tenantId: tenant.tenant.id } });

    // branchId inexistente => violacao de FK no replaceAnnouncementAudience,
    // que acontece DEPOIS de createAnnouncementDraft dentro da composicao.
    await expect(
      withTenant({ tenantId: tenant.tenant.id }, (tx) =>
        createAndScheduleAnnouncement(
          tx,
          input({ title: "Agendamento que falha", branchIds: [randomUUID()] }),
          new Date(Date.now() + 60 * 60_000),
        ),
      ),
    ).rejects.toThrow();

    const countAfter = await ownerDb.announcement.count({ where: { tenantId: tenant.tenant.id } });
    expect(countAfter).toBe(countBefore);
  });
});

describe("INC-018 — salvar rascunho segue inalterado (nao-regressao)", () => {
  it("rascunho pelo caminho antigo: sem numero, 1 versao, seq_number/year nulos", async () => {
    const draftId = await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
      const draft = await createAnnouncementDraft(tx, {
        tenantId: tenant.tenant.id,
        category: "RH",
        criticality: "info",
        createdBy: tenant.users[0].id,
      });
      await createAnnouncementVersion(tx, {
        tenantId: tenant.tenant.id,
        announcementId: draft.id,
        title: "Rascunho inalterado",
        body: "<p>corpo</p>",
        createdBy: tenant.users[0].id,
      });
      return draft.id;
    });

    const draft = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findAnnouncementById(tx, tenant.tenant.id, draftId),
    );
    expect(draft?.status).toBe("draft");
    expect(draft?.seqNumber).toBeNull();
    expect(draft?.year).toBeNull();
    expect(draft?.publishAt).toBeNull();

    const history = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findAnnouncementVersionHistory(tx, draftId),
    );
    expect(history.length).toBe(1);
  });
});
