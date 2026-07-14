import type { Prisma } from "@prisma/client";

export type NotificationInput = {
  tenantId: string;
  userId: string;
  type: string;
  message: string;
  announcementId?: string;
};

/**
 * Ponto de extensao usado pelo INC-012: `PushNotificationChannel` implementa
 * esta mesma interface e e' combinado com `InAppNotificationChannel` (ver
 * `CompositeNotificationChannel`) no unico call site de
 * `remindPendingUsers` — nenhum codigo de dominio mudou, so' o canal
 * injetado.
 */
export interface NotificationChannel {
  send(tx: Prisma.TransactionClient, input: NotificationInput): Promise<void>;
}
