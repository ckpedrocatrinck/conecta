import type { Prisma } from "@prisma/client";
import { createNotification } from "../repositories/notification.repository";
import type { NotificationChannel, NotificationInput } from "./channel";

export class InAppNotificationChannel implements NotificationChannel {
  async send(tx: Prisma.TransactionClient, input: NotificationInput): Promise<void> {
    await createNotification(tx, { ...input, channel: "in_app" });
  }
}
