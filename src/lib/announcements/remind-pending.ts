import type { Prisma } from "@prisma/client";
import { getAnnouncementPendencyDetail, type PendencyScope } from "./pending-panel";
import { formatAnnouncementCode } from "./publish";
import type { NotificationChannel } from "../notifications/channel";

export type RemindPendingOutcome = { notifiedCount: number } | null;

/**
 * "Cobrar pendentes": reusa getAnnouncementPendencyDetail (INC-006) — nunca
 * recalcula quem esta pendente por conta propria. Chamar sempre dentro de um
 * `withTenant`/transacao: a leitura de `.pending` acontece na MESMA transacao
 * que grava as notificacoes, entao qualquer ack que ja tenha commitado antes
 * dessa transacao comecar (inclusive um ack que aconteceu entre o clique do
 * admin/gestor e o processamento) ja esta refletido e a pessoa nao e' notificada.
 * Devolve `null` nos mesmos casos em que getAnnouncementPendencyDetail devolve
 * `null` (comunicado inexistente/nao requires_ack/fora do escopo do gestor).
 */
export async function remindPendingUsers(
  tx: Prisma.TransactionClient,
  tenantId: string,
  announcementId: string,
  scope: PendencyScope,
  channel: NotificationChannel,
): Promise<RemindPendingOutcome> {
  const detail = await getAnnouncementPendencyDetail(tx, tenantId, announcementId, scope);
  if (!detail) return null;

  const code =
    detail.announcement.seqNumber != null && detail.announcement.year != null
      ? formatAnnouncementCode(detail.announcement.seqNumber, detail.announcement.year)
      : detail.announcement.category;

  for (const user of detail.pending) {
    await channel.send(tx, {
      tenantId,
      userId: user.id,
      type: "pendency_reminder",
      message: `RH pediu para você confirmar a ciência do comunicado ${code}.`,
      announcementId,
    });
  }

  return { notifiedCount: detail.pending.length };
}
