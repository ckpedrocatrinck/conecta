import type { Prisma } from "@prisma/client";

export function recordAuditLog(
  tx: Prisma.TransactionClient,
  data: {
    tenantId: string;
    actorUserId: string | null;
    action: string;
    entity: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  },
) {
  return tx.auditLog.create({
    data: {
      tenantId: data.tenantId,
      actorUserId: data.actorUserId,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId,
      // Prisma.InputJsonValue nao unifica estruturalmente com
      // Record<string, unknown> (index signature vs union de tipos Json) —
      // cast seguro aqui porque o formato ja e' JSON-serializavel por
      // construcao (so' recebemos objetos literais dos chamadores).
      metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

/** Tela de consulta simples do admin (INC-007) — mais recentes primeiro,
 * limitado (sem paginacao completa no MVP). Traz o nome do ator em 1 query
 * (join via a relacao `actorUser`) em vez de N+1. */
export function findAuditLogsForTenant(tx: Prisma.TransactionClient, tenantId: string, limit = 200) {
  return tx.auditLog.findMany({
    where: { tenantId },
    include: { actorUser: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
