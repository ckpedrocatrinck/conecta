import type { Prisma } from "@prisma/client";

export type PushSubscriptionKeys = { p256dh: string; auth: string };

export type SavePushSubscriptionInput = {
  tenantId: string;
  userId: string;
  endpoint: string;
  keys: PushSubscriptionKeys;
};

/**
 * "Salvar" nao e' upsert do Prisma de proposito: o GRANT de
 * `push_subscriptions` (migration `rls_and_triggers`, INC-002) e' so'
 * SELECT/INSERT/DELETE — sem UPDATE. Resubscrever o mesmo endpoint (mesmo
 * dispositivo/navegador) e' idempotente: se a linha ja existe, e' no-op.
 */
export async function savePushSubscription(tx: Prisma.TransactionClient, input: SavePushSubscriptionInput) {
  const existing = await tx.pushSubscription.findUnique({
    where: { userId_endpoint: { userId: input.userId, endpoint: input.endpoint } },
  });
  if (existing) return existing;

  return tx.pushSubscription.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      endpoint: input.endpoint,
      keys: input.keys,
    },
  });
}

export function findPushSubscriptionsForUser(tx: Prisma.TransactionClient, tenantId: string, userId: string) {
  return tx.pushSubscription.findMany({ where: { tenantId, userId } });
}

/** Escopado a tenant+user (mesma defesa de markNotificationRead): um id
 * adivinhado de outro usuario/tenant nao apaga nada. */
export function deletePushSubscriptionById(tx: Prisma.TransactionClient, tenantId: string, userId: string, id: string) {
  return tx.pushSubscription.deleteMany({ where: { id, tenantId, userId } });
}

export function deletePushSubscriptionByEndpoint(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  endpoint: string,
) {
  return tx.pushSubscription.deleteMany({ where: { tenantId, userId, endpoint } });
}
