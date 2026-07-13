import type { Prisma } from "@prisma/client";

export type NotificationInput = {
  tenantId: string;
  userId: string;
  type: string;
  message: string;
  announcementId?: string;
};

/**
 * Ponto de extensao para o INC-012: o push real implementa esta mesma
 * interface (`PushNotificationChannel`, usando `PushSubscription`, hoje
 * dormente) e passa a ser combinado com `InAppNotificationChannel` por quem
 * chama `remindPendingUsers` — nenhum codigo de dominio muda, so' o canal
 * injetado.
 */
export interface NotificationChannel {
  send(tx: Prisma.TransactionClient, input: NotificationInput): Promise<void>;
}
