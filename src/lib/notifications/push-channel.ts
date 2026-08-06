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
  /**
   * `tenantSlug` alimenta a URL de destino do clique na notificacao (INC-026).
   * O service worker tem escopo `/` e NAO conhece o tenant, e toda rota do
   * produto vive sob `/{slug}` — sem isso, o clique so' poderia cair na raiz,
   * que para um colaborador logado e' um beco. Vem pelo construtor, e nao por
   * `NotificationInput`, para nao mexer em `remindPendingUsers` nem no canal
   * in-app: o unico ponto de integracao continua sendo a Server Action.
   * Opcional — sem ele o payload sai sem `url` e o SW abre a raiz.
   */
  constructor(
    private readonly sendPush: SendPushFn = defaultSendPush,
    private readonly tenantSlug?: string,
  ) {}

  async send(tx: Prisma.TransactionClient, input: NotificationInput): Promise<void> {
    const subscriptions = await findPushSubscriptionsForUser(tx, input.tenantId, input.userId);
    const url =
      this.tenantSlug && input.announcementId
        ? `/${this.tenantSlug}/comunicados/${input.announcementId}`
        : undefined;
    const payload = JSON.stringify({
      title: "Conecta",
      body: input.message,
      announcementId: input.announcementId,
      // Destino do clique: a tela do comunicado, que e' onde fica o botao de
      // confirmar ciencia — exatamente o que a mensagem pede. `/{slug}/pendencias`
      // seria errado para o publico principal: e' `requireAdminOrManager`, e
      // colaborador cairia em 403.
      ...(url ? { url } : {}),
    });

    for (const subscription of subscriptions) {
      try {
        await this.sendPush(
          { endpoint: subscription.endpoint, keys: subscription.keys as unknown as PushSubscriptionKeys },
          payload,
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;

        // INC-026: ate' aqui este catch descartava TUDO que nao fosse 404/410 —
        // 401 de VAPID invalida, 403, 413, timeout, DNS, TLS — sem uma linha de
        // log. Foi o que cegou a investigacao de 2026-08-06. Continua NAO
        // relancando (DP-17: erro de push jamais aborta a transacao); a unica
        // mudanca e' passar a deixar rastro.
        // Nao loga o endpoint inteiro (contem o token do dispositivo, material
        // de autenticacao) — so' o host. `userId` e' uuid opaco, sem dado
        // pessoal, e e' o que permite correlacionar com a subscription.
        console.error(
          `[PUSH_SEND_FAILED] status=${statusCode ?? "n/a"} host=${endpointHost(subscription.endpoint)} ` +
            `user=${input.userId} error=${describeError(error)}`,
        );

        if (statusCode === 404 || statusCode === 410) {
          // Subscription expirada/revogada no navegador — autolimpeza.
          await deletePushSubscriptionByEndpoint(tx, input.tenantId, input.userId, subscription.endpoint);
        }
      }
    }
  }
}

function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return "endpoint-invalido";
  }
}

/** Mensagem + `body` da resposta do provedor (a Apple manda o motivo ali),
 * truncados. Nunca serializa o erro inteiro: `WebPushError` carrega o endpoint. */
function describeError(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const body = (error as { body?: unknown }).body;
  const detail = typeof body === "string" && body.trim() !== "" ? ` body=${body.slice(0, 200)}` : "";
  return `${message.slice(0, 200)}${detail}`;
}
