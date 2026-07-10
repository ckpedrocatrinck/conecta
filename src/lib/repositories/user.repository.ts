import type { Prisma } from "@prisma/client";

export function findUsersByTenant(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.user.findMany({ where: { tenantId } });
}

export function findUserById(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.user.findFirst({ where: { id, tenantId } });
}
