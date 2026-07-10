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
