import type { Prisma } from "@prisma/client";

export function findJobOpeningsByTenant(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.jobOpening.findMany({ where: { tenantId } });
}

export function findJobOpeningById(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.jobOpening.findFirst({ where: { id, tenantId } });
}
