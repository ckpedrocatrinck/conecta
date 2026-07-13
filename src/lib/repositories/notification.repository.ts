import type { Prisma } from "@prisma/client";

export type CreateNotificationInput = {
  tenantId: string;
  userId: string;
  type: string;
  message: string;
  announcementId?: string;
  channel: string;
};

export function createNotification(tx: Prisma.TransactionClient, input: CreateNotificationInput) {
  return tx.notification.create({ data: input });
}

export function findUnreadNotificationsForUser(tx: Prisma.TransactionClient, tenantId: string, userId: string) {
  return tx.notification.findMany({
    where: { tenantId, userId, readAt: null },
    orderBy: { createdAt: "desc" },
  });
}

/** So marca como lida se a notificacao for do proprio usuario (defesa contra
 * um userId adivinhado marcar notificacao alheia como lida). */
export function markNotificationRead(tx: Prisma.TransactionClient, tenantId: string, userId: string, id: string) {
  return tx.notification.updateMany({
    where: { id, tenantId, userId },
    data: { readAt: new Date() },
  });
}
