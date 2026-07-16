import webpush from "web-push";
import type { Prisma } from "@prisma/client";
import type { NotificationChannel, NotificationInput } from "./channel";
import {
  deletePushSubscriptionByEndpoint,
  findPushSubscriptionsForUser,
  type PushSubscriptionKeys,
} from "../repositories/push-subscription.repository";

export type SendPushFn = (
  subscription: { endpoint: string; keys: PushSubscriptionKeys },
  payload: string,
) => Promise<unknown>;

function defaultSendPush(subscription: { endpoint: string; keys: PushSubscriptionKeys }, payload: string) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    process.env.VAPID_PRIVATE_KEY ?? "",
  );
  return webpush.sendNotification(subscription, payload);
}

/**
 * Push real (INC-012), unico gatilho no escopo: cobranca de pendencia. Roda
 * a chamada HTTP de push DENTRO da transacao recebida via `send(tx, ...)` —
 * exigencia do contrato `NotificationChannel` do INC-007, nao alterado aqui.
 * Aceito para o piloto (ver DP-17 em docs/05-Decisoes-Pendentes.md para o
 * tradeoff de escala). Erro de envio nunca aborta a transacao: e' capturado
 * aqui, nunca relancado — a mesma garantia do canal in-app.
 */
export class PushNotificationChannel implements NotificationChannel {
  constructor(private readonly sendPush: SendPushFn = defaultSendPush) {}

  async send(tx: Prisma.TransactionClient, input: NotificationInput): Promise<void> {
    const subscriptions = await findPushSubscriptionsForUser(tx, input.tenantId, input.userId);
    const payload = JSON.stringify({ title: "Conecta", body: input.message, announcementId: input.announcementId });

    for (const subscription of subscriptions) {
      try {
        await this.sendPush(
          { endpoint: subscription.endpoint, keys: subscription.keys as unknown as PushSubscriptionKeys },
          payload,
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expirada/revogada no navegador — autolimpeza.
          await deletePushSubscriptionByEndpoint(tx, input.tenantId, input.userId, subscription.endpoint);
        }
      }
    }
  }
}
