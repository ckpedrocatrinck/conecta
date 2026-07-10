import type { Prisma } from "@prisma/client";
import { computeContentHash } from "../crypto/content-hash";

export type CreateAnnouncementVersionInput = {
  tenantId: string;
  announcementId: string;
  title: string;
  body: string;
  createdBy: string;
  isMaterialChange?: boolean;
};

/**
 * Sempre INSERT — announcement_versions e' append-only por desenho (grant
 * do INC-002 nao inclui UPDATE, ver migration rls_and_triggers): mesmo
 * edicoes de rascunho geram nova versao, nunca sobrescrevem a anterior.
 * `isMaterialChange` so' tem efeito pratico (reabrir pendencias) no INC-005 —
 * aqui so' persistimos a flag na versao criada.
 */
export async function createAnnouncementVersion(tx: Prisma.TransactionClient, input: CreateAnnouncementVersionInput) {
  const latest = await tx.announcementVersion.findFirst({
    where: { announcementId: input.announcementId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });

  return tx.announcementVersion.create({
    data: {
      tenantId: input.tenantId,
      announcementId: input.announcementId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      title: input.title,
      body: input.body,
      contentHash: computeContentHash(input.title, input.body),
      isMaterialChange: input.isMaterialChange ?? false,
      createdBy: input.createdBy,
    },
  });
}

export function findLatestAnnouncementVersion(tx: Prisma.TransactionClient, announcementId: string) {
  return tx.announcementVersion.findFirst({
    where: { announcementId },
    orderBy: { versionNumber: "desc" },
  });
}

export function findAnnouncementVersionHistory(tx: Prisma.TransactionClient, announcementId: string) {
  return tx.announcementVersion.findMany({
    where: { announcementId },
    orderBy: { versionNumber: "desc" },
  });
}
