import type { Prisma } from "@prisma/client";

export function findPostsByTenant(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.post.findMany({ where: { tenantId } });
}

export function findPostById(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.post.findFirst({ where: { id, tenantId } });
}
