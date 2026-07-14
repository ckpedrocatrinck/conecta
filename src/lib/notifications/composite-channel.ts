import type { Prisma } from "@prisma/client";
import type { NotificationChannel, NotificationInput } from "./channel";

/** Combina canais (previsto no comentario de channel.ts desde o INC-007):
 * chama `.send` em cada, sequencialmente, na mesma transacao. */
export class CompositeNotificationChannel implements NotificationChannel {
  constructor(private readonly channels: NotificationChannel[]) {}

  async send(tx: Prisma.TransactionClient, input: NotificationInput): Promise<void> {
    for (const channel of this.channels) {
      await channel.send(tx, input);
    }
  }
}
