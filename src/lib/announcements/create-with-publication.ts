import type { AnnouncementCriticality, Prisma } from "@prisma/client";
import { createAnnouncementDraft, scheduleAnnouncementPublication } from "../repositories/announcement.repository";
import { createAnnouncementVersion } from "../repositories/announcement-version.repository";
import { replaceAnnouncementAudience } from "../repositories/announcement-audience.repository";
import { recordAuditLog } from "../repositories/audit-log.repository";
import { sanitizeAnnouncementBody } from "../sanitize/announcement-body";
import { publishAnnouncement } from "./publish";

export type NewAnnouncementInput = {
  tenantId: string;
  createdBy: string;
  title: string;
  /** HTML do editor; sanitizado aqui dentro (idempotente se o chamador ja'
   * sanitizou pra validar). */
  body: string;
  category: string;
  criticality: AnnouncementCriticality;
  /** Vazio = toda a empresa. */
  branchIds: string[];
};

/**
 * Composicao create+publish / create+schedule do INC-018 — o admin escolhe o
 * destino do comunicado ja' na tela de criacao, sem passar por
 * /admin/comunicados/[id].
 *
 * NAO ha' logica de publicacao nem de numeracao aqui: as duas funcoes abaixo
 * so' encadeiam primitivos que ja' existiam no INC-004
 * (`createAnnouncementDraft`, `createAnnouncementVersion`,
 * `replaceAnnouncementAudience`, `publishAnnouncement`,
 * `scheduleAnnouncementPublication`). `publishAnnouncement` ja' recebia um
 * `Prisma.TransactionClient` externo, entao a composicao numa transacao unica
 * saiu sem tocar em publish.ts nem no contador de sequencia.
 *
 * INVARIANTE "sem rascunho orfao" (INC-018 item 3, opcao preferida): ambas as
 * funcoes rodam INTEIRAS dentro do `tx` que recebem — o chamador abre um unico
 * `withTenant`, que e' uma transacao Prisma. Se a publicacao (ou o
 * agendamento) falhar, o rollback leva o rascunho e a primeira versao embora;
 * nunca sobra comunicado a meio caminho. Consequencia deliberada: a aquisicao
 * atomica de `seq_number` (INSERT ... ON CONFLICT) e o `count`-check do UPDATE
 * final continuam na MESMA transacao que cria a linha, exatamente como o
 * caminho antigo (rascunho -> publicar na tela [id]).
 *
 * Por isso estas funcoes recebem `tx` e nao abrem transacao propria: quem
 * decide o escopo transacional e' a Server Action (ou o teste).
 */
async function createDraftWithFirstVersion(
  tx: Prisma.TransactionClient,
  input: NewAnnouncementInput,
): Promise<string> {
  const announcement = await createAnnouncementDraft(tx, {
    tenantId: input.tenantId,
    category: input.category,
    criticality: input.criticality,
    createdBy: input.createdBy,
  });

  await createAnnouncementVersion(tx, {
    tenantId: input.tenantId,
    announcementId: announcement.id,
    title: input.title,
    body: sanitizeAnnouncementBody(input.body),
    createdBy: input.createdBy,
  });

  await replaceAnnouncementAudience(tx, input.tenantId, announcement.id, input.branchIds);

  await recordAuditLog(tx, {
    tenantId: input.tenantId,
    actorUserId: input.createdBy,
    action: "announcement.create_draft",
    entity: "Announcement",
    entityId: announcement.id,
  });

  return announcement.id;
}

export type CreateAndPublishResult = { announcementId: string; seqNumber: number; year: number };

/**
 * Cria o comunicado + 1a versao e publica no mesmo passo (mesma transacao).
 *
 * Lanca se `publishAnnouncement` devolver "skipped": num comunicado criado
 * nesta mesma transacao isso e' impossivel por construcao (ninguem mais ve a
 * linha antes do commit), logo significa invariante rompida — e lancar aqui e'
 * o que garante o rollback em vez de deixar um rascunho publicado pela metade.
 */
export async function createAndPublishAnnouncement(
  tx: Prisma.TransactionClient,
  input: NewAnnouncementInput,
  now: Date = new Date(),
): Promise<CreateAndPublishResult> {
  const announcementId = await createDraftWithFirstVersion(tx, input);

  const outcome = await publishAnnouncement(tx, { tenantId: input.tenantId, announcementId }, now);
  if (outcome.status !== "published") {
    throw new Error(
      `createAndPublishAnnouncement: publishAnnouncement retornou "${outcome.status}" para um comunicado criado na mesma transacao`,
    );
  }

  await recordAuditLog(tx, {
    tenantId: input.tenantId,
    actorUserId: input.createdBy,
    action: "announcement.publish",
    entity: "Announcement",
    entityId: announcementId,
    metadata: { seqNumber: outcome.seqNumber, year: outcome.year, from: "create" },
  });

  return { announcementId, seqNumber: outcome.seqNumber, year: outcome.year };
}

/**
 * Cria o comunicado + 1a versao e deixa em `scheduled` com `publish_at`
 * (mesma transacao). Nao atribui numero — quem publica e' o sweep do cron
 * (`runScheduledAnnouncementSweep`, INC-004), que consome o proximo numero na
 * hora.
 *
 * `publishAt` chega em UTC; validar "no futuro" e' responsabilidade do
 * chamador (Server Action), que e' quem sabe reportar erro ao admin.
 */
export async function createAndScheduleAnnouncement(
  tx: Prisma.TransactionClient,
  input: NewAnnouncementInput,
  publishAt: Date,
): Promise<{ announcementId: string }> {
  const announcementId = await createDraftWithFirstVersion(tx, input);

  const scheduled = await scheduleAnnouncementPublication(tx, input.tenantId, announcementId, publishAt);
  if (scheduled.count === 0) {
    throw new Error(
      "createAndScheduleAnnouncement: scheduleAnnouncementPublication nao afetou nenhuma linha para um rascunho criado na mesma transacao",
    );
  }

  await recordAuditLog(tx, {
    tenantId: input.tenantId,
    actorUserId: input.createdBy,
    action: "announcement.schedule",
    entity: "Announcement",
    entityId: announcementId,
    metadata: { publishAt: publishAt.toISOString(), from: "create" },
  });

  return { announcementId };
}
