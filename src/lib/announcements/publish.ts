import type { Prisma } from "@prisma/client";
import { findAnnouncementById, markAnnouncementPublished } from "../repositories/announcement.repository";
import { nextAnnouncementSequenceNumber } from "../repositories/announcement-sequence.repository";
import { getSaoPauloYear } from "../dates/format-datetime";

export type PublishAnnouncementOutcome =
  | { status: "published"; seqNumber: number; year: number }
  | { status: "skipped" };

/**
 * Unico caminho que publica um comunicado (draft ou scheduled -> published),
 * chamado tanto pela Server Action "Publicar agora" quanto pelo sweep do
 * cron (src/app/api/cron/publish-announcements) — garante que a mesma
 * proteção de corrida vale nos dois casos. Deve rodar dentro de um
 * `withTenant` (a atribuicao do numero e a gravacao do status precisam
 * estar na mesma transacao).
 *
 * "skipped" cobre o caso raro de dois admins publicando o MESMO rascunho ao
 * mesmo tempo: o segundo a chegar aqui ve status != draft/scheduled (o
 * primeiro ja' comitou) e nao consome numero nem sobrescreve nada — nunca
 * gera numero duplicado, na pior hipotese deixa uma lacuna na sequencia.
 */
export async function publishAnnouncement(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; announcementId: string },
  now: Date = new Date(),
): Promise<PublishAnnouncementOutcome> {
  const current = await findAnnouncementById(tx, input.tenantId, input.announcementId);
  if (!current || (current.status !== "draft" && current.status !== "scheduled")) {
    return { status: "skipped" };
  }

  const year = getSaoPauloYear(now);
  const seqNumber = await nextAnnouncementSequenceNumber(tx, input.tenantId, year);
  const result = await markAnnouncementPublished(tx, input.tenantId, input.announcementId, { seqNumber, year });

  // count 0 = perdeu a corrida entre o SELECT acima e este UPDATE (outro
  // admin publicou o MESMO rascunho no meio do caminho — o UPDATE dele
  // bloqueou o nosso, comitou primeiro, e nossa WHERE parou de bater). O
  // numero acima fica como lacuna (aceitavel); o que NUNCA pode acontecer e'
  // reportar "published" sem a linha ter sido de fato atualizada.
  if (result.count === 0) {
    return { status: "skipped" };
  }

  return { status: "published", seqNumber, year };
}

export function formatAnnouncementCode(seqNumber: number, year: number): string {
  return `CI ${String(seqNumber).padStart(2, "0")}/${year}`;
}
