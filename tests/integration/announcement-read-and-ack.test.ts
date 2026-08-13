import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { cleanupTenant } from "../helpers/cleanup-tenant";
import { withTenant } from "../../src/lib/db/with-tenant";
import { publishAnnouncement } from "../../src/lib/announcements/publish";
import { buildAnnouncementReaderState } from "../../src/lib/announcements/reader-state";
import {
  createAnnouncementDraft,
  isAnnouncementVisibleToUser,
} from "../../src/lib/repositories/announcement.repository";
import {
  createAnnouncementVersion,
  findAnnouncementVersionHistory,
  findAnnouncementVersionScoped,
} from "../../src/lib/repositories/announcement-version.repository";
import { replaceAnnouncementAudience } from "../../src/lib/repositories/announcement-audience.repository";
import { recordAnnouncementReadOnce, findAnnouncementReadsForUser } from "../../src/lib/repositories/announcement-read.repository";
import { createAnnouncementAckIdempotent, findAnnouncementAcksForUser } from "../../src/lib/repositories/announcement-ack.repository";

const ownerDb = new PrismaClient();

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Read/Ack Test ${suffix}`,
    slug: `read-ack-test-${suffix}`,
    branchCount: 2,
    userCount: 6,
    cpfSeedOffset: 900,
    // Sem amostra: os testes de ack precisam de trigger de imutabilidade
    // ATIVO (nao desabilitado por outro arquivo) — evitar acks de exemplo
    // mantem a limpeza deste arquivo simples (delete direto, sem tocar o
    // trigger global).
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
      body: "<p>corpo original</p>",
      createdBy: tenant.users[0].id,
    });
    if (branchIds.length > 0) {
      await replaceAnnouncementAudience(tx, tenant.tenant.id, draft.id, branchIds);
    }
    await publishAnnouncement(tx, { tenantId: tenant.tenant.id, announcementId: draft.id });
    return { announcementId: draft.id, versionId: version.id, contentHash: version.contentHash };
  });
}

describe("ack duplicado impossivel", () => {
  it("N chamadas concorrentes de createAnnouncementAckIdempotent para o mesmo (announcement, versao, usuario) gravam so' 1 linha", async () => {
    const { announcementId, versionId } = await createPublishedRequiresAck("Ack duplicado");
    const user = tenant.users[1];

    await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
      await Promise.all(
        Array.from({ length: 8 }, () =>
          createAnnouncementAckIdempotent(tx, {
            tenantId: tenant.tenant.id,
            announcementId,
            versionId,
            userId: user.id,
            contentHashAtAck: "hash-fixo-do-teste",
          }),
        ),
      );
    });

    const acks = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findAnnouncementAcksForUser(tx, tenant.tenant.id, user.id, [announcementId]),
    );
    expect(acks.length).toBe(1);
  });
});

describe("ack grava o hash da versao exibida, sob corrida com edicao concorrente", () => {
  it("ack referenciando V1 grava o hash de V1, mesmo que V2 (material) seja publicada no meio do caminho", async () => {
    const { announcementId, versionId: v1Id, contentHash: v1Hash } = await createPublishedRequiresAck("Corrida hash x edicao");
    const user = tenant.users[2];

    const [, ackResult] = await Promise.all([
      withTenant({ tenantId: tenant.tenant.id }, (tx) =>
        createAnnouncementVersion(tx, {
          tenantId: tenant.tenant.id,
          announcementId,
          title: "Corrida hash x edicao — corrigido",
          body: "<p>corpo corrigido durante a corrida</p>",
          createdBy: tenant.users[0].id,
          isMaterialChange: true,
        }),
      ),
      withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
        // Simula o server action: versionId vem do form (V1, a que a pessoa
        // realmente viu), e o hash gravado e' o JA PERSISTIDO dessa versao —
        // nunca recalculado a partir do conteudo "atual".
        const version = await findAnnouncementVersionScoped(tx, tenant.tenant.id, announcementId, v1Id);
        await createAnnouncementAckIdempotent(tx, {
          tenantId: tenant.tenant.id,
          announcementId,
          versionId: v1Id,
          userId: user.id,
          contentHashAtAck: version!.contentHash,
        });
        return version;
      }),
    ]);

    const acks = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findAnnouncementAcksForUser(tx, tenant.tenant.id, user.id, [announcementId]),
    );
    expect(acks.length).toBe(1);
    expect(acks[0].versionId).toBe(v1Id);
    expect(acks[0].contentHashAtAck).toBe(v1Hash);
    expect(ackResult?.contentHash).toBe(v1Hash);

    // Pendencia deve estar reaberta: o ack em V1 nao satisfaz frente a V2 material.
    const versions = await withTenant({ tenantId: tenant.tenant.id }, (tx) => findAnnouncementVersionHistory(tx, announcementId));
    const state = buildAnnouncementReaderState({
      criticality: "requires_ack",
      versions,
      reads: [],
      acks: acks.map((a) => ({ versionId: a.versionId, ackedAt: a.ackedAt })),
    });
    expect(state.ackSatisfied).toBe(false);
    expect(state.awaitingAck).toBe(true);
    expect(state.wasReopened).toBe(true);
  });
});

describe("AnnouncementRead grava so' a primeira abertura por versao", () => {
  it("chamadas repetidas/concorrentes gravam so' 1 linha, com o readAt da primeira", async () => {
    const { announcementId, versionId } = await createPublishedRequiresAck("Leitura unica");
    const user = tenant.users[3];

    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      recordAnnouncementReadOnce(tx, { tenantId: tenant.tenant.id, announcementId, versionId, userId: user.id }),
    );
    const firstReads = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findAnnouncementReadsForUser(tx, tenant.tenant.id, user.id, [announcementId]),
    );
    const firstReadAt = firstReads[0].readAt.getTime();

    await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
      await Promise.all(
        Array.from({ length: 5 }, () =>
          recordAnnouncementReadOnce(tx, { tenantId: tenant.tenant.id, announcementId, versionId, userId: user.id }),
        ),
      );
    });

    const reads = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findAnnouncementReadsForUser(tx, tenant.tenant.id, user.id, [announcementId]),
    );
    expect(reads.length).toBe(1);
    expect(reads[0].readAt.getTime()).toBe(firstReadAt);
  });
});

describe("reabertura de pendencia por versao material (com salto multiplo)", () => {
  it("edicao NAO-material nao reabre; versao material reabre; ack entre dois saltos materiais continua insatisfeito", async () => {
    const { announcementId, versionId: v1Id } = await createPublishedRequiresAck("Reabertura por versao material");
    const user = tenant.users[4];

    // Ack em V1.
    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createAnnouncementAckIdempotent(tx, {
        tenantId: tenant.tenant.id,
        announcementId,
        versionId: v1Id,
        userId: user.id,
        contentHashAtAck: "hash-v1",
      }),
    );

    const stateAfterV1Ack = async () => {
      const [versions, acks] = await Promise.all([
        withTenant({ tenantId: tenant.tenant.id }, (tx) => findAnnouncementVersionHistory(tx, announcementId)),
        withTenant({ tenantId: tenant.tenant.id }, (tx) => findAnnouncementAcksForUser(tx, tenant.tenant.id, user.id, [announcementId])),
      ]);
      return buildAnnouncementReaderState({
        criticality: "requires_ack",
        versions,
        reads: [],
        acks: acks.map((a) => ({ versionId: a.versionId, ackedAt: a.ackedAt })),
      });
    };

    // V2 nao-material: ack em V1 continua satisfazendo.
    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createAnnouncementVersion(tx, {
        tenantId: tenant.tenant.id,
        announcementId,
        title: "Reabertura por versao material — V2 (typo)",
        body: "<p>correcao cosmetica</p>",
        createdBy: tenant.users[0].id,
        isMaterialChange: false,
      }),
    );
    {
      const state = await stateAfterV1Ack();
      expect(state.ackSatisfied).toBe(true);
      // INC-027 bloco 3.12: o ack satisfaz mesmo com V2 ja' publicada, mas foi
      // dado em V1 — a tela de leitura precisa saber disso pra nao alegar que
      // a pessoa confirmou o texto atual (V2), que ela nunca viu.
      expect(state.lastAckedVersionNumber).toBe(1);
      expect(state.latestVersion.versionNumber).toBe(2);
    }

    // V3 material: pendencia reabre.
    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createAnnouncementVersion(tx, {
        tenantId: tenant.tenant.id,
        announcementId,
        title: "Reabertura por versao material — V3 (material)",
        body: "<p>mudanca material</p>",
        createdBy: tenant.users[0].id,
        isMaterialChange: true,
      }),
    );
    expect((await stateAfterV1Ack()).ackSatisfied).toBe(false);
    expect((await stateAfterV1Ack()).wasReopened).toBe(true);

    // V4 nao-material publicada DEPOIS do salto material nao desfaz a reabertura.
    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createAnnouncementVersion(tx, {
        tenantId: tenant.tenant.id,
        announcementId,
        title: "Reabertura por versao material — V4 (typo pos-material)",
        body: "<p>outra correcao cosmetica</p>",
        createdBy: tenant.users[0].id,
        isMaterialChange: false,
      }),
    );
    expect((await stateAfterV1Ack()).ackSatisfied).toBe(false);
  });
});

describe("publico-alvo por filial e' respeitado (isAnnouncementVisibleToUser)", () => {
  it("usuario da filial audienciada ve; usuario de outra filial nao ve; ack fora da audiencia nao e' gravado", async () => {
    const [branchA, branchB] = tenant.branches;
    const userInBranchA = tenant.users.find((u) => u.branchId === branchA.id)!;
    const userInBranchB = tenant.users.find((u) => u.branchId === branchB.id)!;

    const { announcementId, versionId } = await createPublishedRequiresAck("So' filial A (ponto-a-ponto)", [branchA.id]);

    const visibleToA = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      isAnnouncementVisibleToUser(tx, tenant.tenant.id, userInBranchA.id, announcementId),
    );
    const visibleToB = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      isAnnouncementVisibleToUser(tx, tenant.tenant.id, userInBranchB.id, announcementId),
    );
    expect(visibleToA).toBe(true);
    expect(visibleToB).toBe(false);

    // Simula o server action de ack para quem NAO esta na audiencia: a
    // revalidacao de visibilidade deve impedir a gravacao mesmo sabendo o UUID.
    await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
      const visible = await isAnnouncementVisibleToUser(tx, tenant.tenant.id, userInBranchB.id, announcementId);
      if (!visible) return;
      await createAnnouncementAckIdempotent(tx, {
        tenantId: tenant.tenant.id,
        announcementId,
        versionId,
        userId: userInBranchB.id,
        contentHashAtAck: "nao-deveria-gravar",
      });
    });

    const acksFromB = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findAnnouncementAcksForUser(tx, tenant.tenant.id, userInBranchB.id, [announcementId]),
    );
    expect(acksFromB.length).toBe(0);
  });
});

describe("findAnnouncementVersionScoped rejeita versionId de outro announcement", () => {
  it("versao pertencente a announcement X nao e' encontrada quando escopada a announcement Y", async () => {
    const a = await createPublishedRequiresAck("Announcement X");
    const b = await createPublishedRequiresAck("Announcement Y");

    const scopedCorretamente = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findAnnouncementVersionScoped(tx, tenant.tenant.id, a.announcementId, a.versionId),
    );
    const scopedErrado = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findAnnouncementVersionScoped(tx, tenant.tenant.id, b.announcementId, a.versionId),
    );

    expect(scopedCorretamente).not.toBeNull();
    expect(scopedErrado).toBeNull();
  });
});
