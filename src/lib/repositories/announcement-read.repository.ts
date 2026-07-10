import type { Prisma } from "@prisma/client";

export type RecordAnnouncementReadInput = {
  tenantId: string;
  announcementId: string;
  versionId: string;
  userId: string;
};

/**
 * Grava a leitura so' se ainda nao existir para (announcementId, versionId,
 * userId) — `skipDuplicates` traduz para ON CONFLICT DO NOTHING respeitando
 * a unique constraint do schema (ADR-006: so' a 1a abertura por versao gera
 * registro; nunca um upsert, que atualizaria `readAt`).
 */
export function recordAnnouncementReadOnce(tx: Prisma.TransactionClient, input: RecordAnnouncementReadInput) {
  return tx.announcementRead.createMany({ data: [input], skipDuplicates: true });
}

export function findAnnouncementReadsForUser(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  announcementIds: string[],
) {
  return tx.announcementRead.findMany({
    where: { tenantId, userId, announcementId: { in: announcementIds } },
  });
}
