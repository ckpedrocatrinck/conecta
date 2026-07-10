import type { Prisma } from "@prisma/client";

export function findAnnouncementsByTenant(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.announcement.findMany({ where: { tenantId } });
}

export function findAnnouncementById(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.announcement.findFirst({ where: { id, tenantId } });
}
