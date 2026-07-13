import type { AnnouncementCriticality, AnnouncementStatus, Prisma } from "@prisma/client";

export function findAnnouncementsByTenant(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.announcement.findMany({ where: { tenantId } });
}

export function findAnnouncementById(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.announcement.findFirst({ where: { id, tenantId } });
}

export function findAnnouncementWithLatestVersion(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.announcement.findFirst({
    where: { id, tenantId },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
}

export type CreateAnnouncementDraftInput = {
  tenantId: string;
  category: string;
  criticality: AnnouncementCriticality;
  createdBy: string;
};

/** Rascunho nunca recebe seq_number/year (regra de dominio — atribuidos so'
 * na publicacao, ver src/lib/announcements/publish.ts). */
export function createAnnouncementDraft(tx: Prisma.TransactionClient, data: CreateAnnouncementDraftInput) {
  return tx.announcement.create({
    data: {
      tenantId: data.tenantId,
      category: data.category,
      criticality: data.criticality,
      createdBy: data.createdBy,
      status: "draft",
    },
  });
}

export function updateAnnouncementCategory(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  category: string,
) {
  return tx.announcement.updateMany({ where: { id, tenantId }, data: { category } });
}

/** So' chamar quando `seqNumber` ainda e' null (nunca foi publicado) — a
 * Server Action decide isso com base no estado atual lido do banco, nunca
 * confiando em atributo `disabled` do formulario. */
export function updateAnnouncementCriticality(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  criticality: AnnouncementCriticality,
) {
  return tx.announcement.updateMany({ where: { id, tenantId, seqNumber: null }, data: { criticality } });
}

/** So' agenda quem esta em draft — evita reagendar algo ja publicado/arquivado
 * por engano (a Server Action deve tratar count=0 como "estado inesperado"). */
export function scheduleAnnouncementPublication(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  publishAt: Date,
) {
  return tx.announcement.updateMany({
    where: { id, tenantId, status: "draft" },
    data: { status: "scheduled", publishAt },
  });
}

export function unscheduleAnnouncement(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.announcement.updateMany({
    where: { id, tenantId, status: "scheduled" },
    data: { status: "draft", publishAt: null },
  });
}

/** archived e' terminal (MVP) — sem caminho de volta para published. */
export function archiveAnnouncement(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.announcement.updateMany({
    where: { id, tenantId, status: { in: ["draft", "scheduled", "published"] } },
    data: { status: "archived" },
  });
}

/** So' usado por publishAnnouncement() — nunca chamar direto de uma Server
 * Action (precisa rodar depois de nextAnnouncementSequenceNumber, na mesma
 * transacao). O filtro de status na WHERE e' o que torna inofensiva uma
 * corrida em que dois admins publicam o MESMO rascunho ao mesmo tempo: o
 * segundo UPDATE afeta 0 linhas (numero ja' consumido fica como lacuna, nunca
 * duplicado). */
export function markAnnouncementPublished(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  data: { seqNumber: number; year: number },
) {
  return tx.announcement.updateMany({
    where: { id, tenantId, status: { in: ["draft", "scheduled"] } },
    data: { status: "published", seqNumber: data.seqNumber, year: data.year },
  });
}

export function findDueScheduledAnnouncements(tx: Prisma.TransactionClient, tenantId: string, now: Date) {
  return tx.announcement.findMany({
    where: { tenantId, status: "scheduled", publishAt: { lte: now } },
  });
}

export function findAnnouncementsForAdminList(
  tx: Prisma.TransactionClient,
  tenantId: string,
  status?: AnnouncementStatus,
) {
  return tx.announcement.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * IDs de announcement cuja versao ATUAL (maior version_number) bate com a
 * busca full-text pt-BR — usa o indice GIN em
 * announcement_versions.search_vector (coluna gerada, ja' criada na
 * migration rls_and_triggers do INC-002). O filtro por "e' a versao mais
 * recente" e' deliberado: um termo que so' existia numa versao ja'
 * substituida nao deve aparecer na busca do conteudo atual.
 */
export async function searchAnnouncementIds(
  tx: Prisma.TransactionClient,
  tenantId: string,
  query: string,
): Promise<string[]> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT a.id AS id
    FROM announcements a
    JOIN announcement_versions v ON v.announcement_id = a.id
    WHERE a.tenant_id = ${tenantId}::uuid
      AND v.version_number = (
        SELECT MAX(version_number) FROM announcement_versions WHERE announcement_id = a.id
      )
      AND v.search_vector @@ plainto_tsquery('portuguese', ${query})
  `;
  return rows.map((r) => r.id);
}

/**
 * Comunicados `requires_ack` publicados OU arquivados de um tenant — base do
 * painel de pendencias (INC-006). Inclui arquivados deliberadamente (DP-11):
 * diferente de `findVisibleAnnouncementIdsForUser` (so' published, usado pela
 * lista do colaborador), o RH precisa enxergar pendencia que ficou sem
 * resposta e foi "absolvida" pelo arquivamento.
 */
export function findRequiresAckAnnouncementsForPanel(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.announcement.findMany({
    where: { tenantId, criticality: "requires_ack", status: { in: ["published", "archived"] } },
  });
}

/**
 * Anuncios publicados visiveis para um usuario: audiencia vazia = todos;
 * audiencia com filiais = so' quem esta numa delas. Usada pelo INC-005 (tela
 * de leitura do colaborador) — aqui so' garantimos que a regra de dados
 * restringe corretamente, sem construir a UI de consumo.
 */
export async function findVisibleAnnouncementIdsForUser(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
): Promise<string[]> {
  const user = await tx.user.findFirstOrThrow({
    where: { id: userId, tenantId },
    select: { branchId: true },
  });

  const [published, audienceRows, userBranchAudienceRows] = await Promise.all([
    tx.announcement.findMany({ where: { tenantId, status: "published" }, select: { id: true } }),
    tx.announcementAudience.findMany({ where: { tenantId }, select: { announcementId: true }, distinct: ["announcementId"] }),
    tx.announcementAudience.findMany({ where: { tenantId, branchId: user.branchId }, select: { announcementId: true } }),
  ]);

  const restrictedIds = new Set(audienceRows.map((a) => a.announcementId));
  const visibleToUserBranch = new Set(userBranchAudienceRows.map((a) => a.announcementId));

  return published.map((a) => a.id).filter((id) => !restrictedIds.has(id) || visibleToUserBranch.has(id));
}

/**
 * Mesma regra de `findVisibleAnnouncementIdsForUser`, mas ponto-a-ponto
 * (O(1), sem escanear todos os anuncios do tenant) — usada para revalidar
 * visibilidade na tela de leitura E no server action de ack. Nunca confiar
 * so' na checagem feita ao montar a lista: sem revalidar aqui, um usuario
 * que descubra/adivinhe o UUID de um comunicado restrito a outra filial
 * poderia gravar um ack valido nele (contamina o registro probatorio,
 * ADR-001).
 */
export async function isAnnouncementVisibleToUser(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  announcementId: string,
): Promise<boolean> {
  const [user, announcement] = await Promise.all([
    tx.user.findFirst({ where: { id: userId, tenantId }, select: { branchId: true } }),
    tx.announcement.findFirst({ where: { id: announcementId, tenantId, status: "published" }, select: { id: true } }),
  ]);
  if (!user || !announcement) return false;

  const audienceRows = await tx.announcementAudience.findMany({
    where: { announcementId, tenantId },
    select: { branchId: true },
  });
  if (audienceRows.length === 0) return true;
  return audienceRows.some((a) => a.branchId === user.branchId);
}
