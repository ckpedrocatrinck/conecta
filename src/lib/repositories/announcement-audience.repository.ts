import type { Prisma } from "@prisma/client";

/**
 * Substitui a audiencia por completo (delete+insert — a unica operacao
 * possivel pelos grants: announcement_audiences nao tem UPDATE, ver
 * migration rls_and_triggers do INC-002). `branchIds` vazio = "todos"
 * (nenhuma linha gravada).
 */
export async function replaceAnnouncementAudience(
  tx: Prisma.TransactionClient,
  tenantId: string,
  announcementId: string,
  branchIds: string[],
) {
  await tx.announcementAudience.deleteMany({ where: { announcementId, tenantId } });
  if (branchIds.length === 0) return;
  await tx.announcementAudience.createMany({
    data: branchIds.map((branchId) => ({ announcementId, branchId, tenantId })),
  });
}

export function findAnnouncementAudienceBranchIds(tx: Prisma.TransactionClient, announcementId: string) {
  return tx.announcementAudience.findMany({ where: { announcementId }, select: { branchId: true } });
}

/** Audiencia de VARIOS comunicados em 1 query — usada pelo painel de
 * pendencias (INC-006) para nao fazer 1 query por comunicado. */
export function findAnnouncementAudienceBranchIdsForAnnouncements(
  tx: Prisma.TransactionClient,
  tenantId: string,
  announcementIds: string[],
) {
  return tx.announcementAudience.findMany({
    where: { tenantId, announcementId: { in: announcementIds } },
    select: { announcementId: true, branchId: true },
  });
}
