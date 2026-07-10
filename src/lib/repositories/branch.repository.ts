import type { Prisma } from "@prisma/client";

export function findBranchesByTenant(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.branch.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
}

export function findBranchById(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.branch.findFirst({ where: { id, tenantId } });
}

export function findBranchByCode(tx: Prisma.TransactionClient, tenantId: string, code: string) {
  return tx.branch.findFirst({ where: { tenantId, code } });
}

export function createBranch(tx: Prisma.TransactionClient, data: { tenantId: string; name: string; code: string }) {
  return tx.branch.create({ data });
}

export function updateBranch(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  data: { name: string; code: string },
) {
  return tx.branch.updateMany({ where: { id, tenantId }, data });
}

/** Pode falhar com violacao de FK (branches.users onDelete: Restrict) se
 * houver colaborador na filial — a camada de apresentacao deve traduzir
 * isso num erro amigavel, nao propagar o erro do Postgres pro usuario. */
export function deleteBranch(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.branch.deleteMany({ where: { id, tenantId } });
}

export function countUsersInBranch(tx: Prisma.TransactionClient, tenantId: string, branchId: string) {
  return tx.user.count({ where: { tenantId, branchId } });
}
