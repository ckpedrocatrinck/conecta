import type { Announcement, Prisma } from "@prisma/client";
import { buildAnnouncementReaderState, computeRequiredAckVersionNumber } from "./reader-state";
import { findAnnouncementById, findRequiresAckAnnouncementsForPanel } from "../repositories/announcement.repository";
import {
  findAnnouncementVersionHistory,
  findAnnouncementVersionsForAnnouncements,
} from "../repositories/announcement-version.repository";
import {
  findAnnouncementAudienceBranchIds,
  findAnnouncementAudienceBranchIdsForAnnouncements,
} from "../repositories/announcement-audience.repository";
import { findAnnouncementAcksForAnnouncements, findAnnouncementAcksForUser } from "../repositories/announcement-ack.repository";
import { findActiveUsersByTenant, findUserById } from "../repositories/user.repository";

/** `branchId` presente = visao do gestor (INC-006): restringe o publico-alvo
 * a essa filial e faz `getAnnouncementPendencyDetail`/`getUserPendencyHistory`
 * devolverem `null` (tratado como 404 pela rota) quando o comunicado/
 * colaborador nao pertence a essa filial. Ausente = visao do admin, sem
 * restricao alem da audiencia do proprio comunicado. */
export type PendencyScope = { branchId?: string };

type ActiveUserLite = { id: string; branchId: string; fullName: string };

function groupBy<T, K>(rows: T[], keyFn: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const key = keyFn(row);
    const bucket = map.get(key);
    if (bucket) bucket.push(row);
    else map.set(key, [row]);
  }
  return map;
}

/**
 * Publico-alvo ATIVO de um comunicado: audiencia vazia = todos os usuarios
 * ativos do tenant; audiencia com filiais = interseccao. `scope.branchId`
 * (gestor) aplica uma segunda interseccao por cima. Mesma regra de audiencia
 * de `findVisibleAnnouncementIdsForUser` (INC-004/005), aqui aplicada sobre
 * `status: active` em vez de "usuario especifico" — e' o denominador do
 * painel de pendencias (INC-006): desligados saem na hora (status e' lido ao
 * vivo, nao na data de publicacao), seus acks historicos continuam intactos
 * em `AnnouncementAck` (imutavel) mas nao contam mais no denominador.
 */
function resolveTargetActiveUsers(
  activeUsers: ActiveUserLite[],
  audienceBranchIds: Set<string>,
  scope: PendencyScope,
): ActiveUserLite[] {
  const isRestricted = audienceBranchIds.size > 0;
  return activeUsers.filter((u) => {
    if (isRestricted && !audienceBranchIds.has(u.branchId)) return false;
    if (scope.branchId && u.branchId !== scope.branchId) return false;
    return true;
  });
}

export type AnnouncementPendencySummary = {
  announcement: Announcement;
  requiredVersionNumber: number;
  targetTotal: number;
  confirmedCount: number;
  pendingCount: number;
  percentConfirmed: number;
  /** DP-11: comunicado arquivado que ainda tinha publico-alvo ativo sem ack
   * valido — sinaliza a pendencia que o arquivamento absolveria em silencio. */
  isArchivedWithPendency: boolean;
};

/**
 * Lista agregada para a tela indice do painel (INC-006). 5 queries no total
 * (nao 1 por comunicado nem 1 por usuario) — pensado para o criterio de
 * performance (500 usuarios x 100 comunicados < 1s): todo o cruzamento
 * comunicado x usuario x ack acontece em memoria depois de buscar os 4 lotes
 * (comunicados, versoes, audiencias, acks) mais os usuarios ativos.
 */
export async function listAnnouncementPendencySummaries(
  tx: Prisma.TransactionClient,
  tenantId: string,
  scope: PendencyScope = {},
): Promise<AnnouncementPendencySummary[]> {
  const announcements = await findRequiresAckAnnouncementsForPanel(tx, tenantId);
  if (announcements.length === 0) return [];
  const announcementIds = announcements.map((a) => a.id);

  const [versions, audienceRows, acks, activeUsers] = await Promise.all([
    findAnnouncementVersionsForAnnouncements(tx, announcementIds),
    findAnnouncementAudienceBranchIdsForAnnouncements(tx, tenantId, announcementIds),
    findAnnouncementAcksForAnnouncements(tx, tenantId, announcementIds),
    findActiveUsersByTenant(tx, tenantId),
  ]);

  const versionsByAnnouncement = groupBy(versions, (v) => v.announcementId);
  const audienceByAnnouncement = groupBy(audienceRows, (a) => a.announcementId);
  const acksByAnnouncement = groupBy(acks, (a) => a.announcementId);

  const summaries: AnnouncementPendencySummary[] = [];

  for (const announcement of announcements) {
    const versionsForAnnouncement = versionsByAnnouncement.get(announcement.id) ?? [];
    if (versionsForAnnouncement.length === 0) continue;

    const requiredVersionNumber = computeRequiredAckVersionNumber(versionsForAnnouncement);
    const versionNumberById = new Map(versionsForAnnouncement.map((v) => [v.id, v.versionNumber]));
    const audienceBranchIds = new Set((audienceByAnnouncement.get(announcement.id) ?? []).map((a) => a.branchId));

    const targetUsers = resolveTargetActiveUsers(activeUsers, audienceBranchIds, scope);
    if (targetUsers.length === 0) continue;

    const satisfyingUserIds = new Set(
      (acksByAnnouncement.get(announcement.id) ?? [])
        .filter((a) => (versionNumberById.get(a.versionId) ?? -1) >= requiredVersionNumber)
        .map((a) => a.userId),
    );

    const targetTotal = targetUsers.length;
    const confirmedCount = targetUsers.filter((u) => satisfyingUserIds.has(u.id)).length;
    const pendingCount = targetTotal - confirmedCount;

    summaries.push({
      announcement,
      requiredVersionNumber,
      targetTotal,
      confirmedCount,
      pendingCount,
      percentConfirmed: Math.round((confirmedCount / targetTotal) * 100),
      isArchivedWithPendency: announcement.status === "archived" && pendingCount > 0,
    });
  }

  summaries.sort((a, b) => (b.announcement.publishAt?.getTime() ?? 0) - (a.announcement.publishAt?.getTime() ?? 0));
  return summaries;
}

export type AnnouncementPendencyDetail = {
  announcement: Announcement;
  requiredVersionNumber: number;
  pending: ActiveUserLite[];
  confirmed: (ActiveUserLite & { ackedAt: Date })[];
};

/**
 * Drill-down de 1 comunicado. Devolve `null` quando o comunicado nao existe,
 * nao e' `requires_ack`, ou (com `scope.branchId`, visao do gestor) nao
 * alcanca a filial dele — a rota trata `null` como 404, que e' a barreira de
 * isolamento entre filiais.
 */
export async function getAnnouncementPendencyDetail(
  tx: Prisma.TransactionClient,
  tenantId: string,
  announcementId: string,
  scope: PendencyScope = {},
): Promise<AnnouncementPendencyDetail | null> {
  const announcement = await findAnnouncementById(tx, tenantId, announcementId);
  if (!announcement) return null;
  if (announcement.criticality !== "requires_ack") return null;
  if (announcement.status !== "published" && announcement.status !== "archived") return null;

  const [versions, audienceRows, acks, activeUsers] = await Promise.all([
    findAnnouncementVersionHistory(tx, announcementId),
    findAnnouncementAudienceBranchIds(tx, announcementId),
    findAnnouncementAcksForAnnouncements(tx, tenantId, [announcementId]),
    findActiveUsersByTenant(tx, tenantId),
  ]);
  if (versions.length === 0) return null;

  const requiredVersionNumber = computeRequiredAckVersionNumber(versions);
  const versionNumberById = new Map(versions.map((v) => [v.id, v.versionNumber]));
  const audienceBranchIds = new Set(audienceRows.map((a) => a.branchId));

  const targetUsers = resolveTargetActiveUsers(activeUsers, audienceBranchIds, scope);
  if (targetUsers.length === 0) return null;

  const lastSatisfyingAckByUser = new Map<string, Date>();
  for (const ack of acks) {
    if ((versionNumberById.get(ack.versionId) ?? -1) < requiredVersionNumber) continue;
    const current = lastSatisfyingAckByUser.get(ack.userId);
    if (!current || ack.ackedAt > current) lastSatisfyingAckByUser.set(ack.userId, ack.ackedAt);
  }

  const pending: ActiveUserLite[] = [];
  const confirmed: (ActiveUserLite & { ackedAt: Date })[] = [];
  for (const user of targetUsers) {
    const ackedAt = lastSatisfyingAckByUser.get(user.id);
    if (ackedAt) confirmed.push({ ...user, ackedAt });
    else pending.push(user);
  }

  return { announcement, requiredVersionNumber, pending, confirmed };
}

export type UserPendencyHistoryItem = {
  announcement: Announcement;
  requiredVersionNumber: number;
  ackSatisfied: boolean;
  awaitingAck: boolean;
  wasReopened: boolean;
  lastAckedAt?: Date;
};

export type UserPendencyHistory = {
  user: ActiveUserLite;
  items: UserPendencyHistoryItem[];
};

/**
 * Historico de acks/pendencias de 1 colaborador (INC-006, visao "por
 * colaborador"). Inclui `requires_ack` publicados E arquivados — diverge de
 * proposito de `findVisibleAnnouncementIdsForUser` (INC-005, so' published):
 * o RH precisa ver o que foi arquivado com pendencia em aberto (DP-11), o
 * colaborador nao. `reads: []` porque essa visao nao distingue "lido" do
 * "confirmado" — so' o estado de ciencia importa aqui.
 * Devolve `null` quando o usuario nao existe ou (visao do gestor) nao e' da
 * filial dele.
 */
export async function getUserPendencyHistory(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  scope: PendencyScope = {},
): Promise<UserPendencyHistory | null> {
  const user = await findUserById(tx, tenantId, userId);
  if (!user) return null;
  if (scope.branchId && user.branchId !== scope.branchId) return null;

  const announcements = await findRequiresAckAnnouncementsForPanel(tx, tenantId);
  const userLite: ActiveUserLite = { id: user.id, branchId: user.branchId, fullName: user.fullName };
  if (announcements.length === 0) return { user: userLite, items: [] };

  const announcementIds = announcements.map((a) => a.id);
  const [versions, audienceRows, acks] = await Promise.all([
    findAnnouncementVersionsForAnnouncements(tx, announcementIds),
    findAnnouncementAudienceBranchIdsForAnnouncements(tx, tenantId, announcementIds),
    findAnnouncementAcksForUser(tx, tenantId, userId, announcementIds),
  ]);

  const versionsByAnnouncement = groupBy(versions, (v) => v.announcementId);
  const audienceByAnnouncement = groupBy(audienceRows, (a) => a.announcementId);
  const acksByAnnouncement = groupBy(acks, (a) => a.announcementId);

  const items: UserPendencyHistoryItem[] = [];
  for (const announcement of announcements) {
    const audienceBranchIds = new Set((audienceByAnnouncement.get(announcement.id) ?? []).map((a) => a.branchId));
    if (audienceBranchIds.size > 0 && !audienceBranchIds.has(user.branchId)) continue;

    const versionsForAnnouncement = versionsByAnnouncement.get(announcement.id) ?? [];
    if (versionsForAnnouncement.length === 0) continue;

    const state = buildAnnouncementReaderState({
      criticality: announcement.criticality,
      versions: versionsForAnnouncement,
      reads: [],
      acks: (acksByAnnouncement.get(announcement.id) ?? []).map((a) => ({ versionId: a.versionId, ackedAt: a.ackedAt })),
    });

    items.push({
      announcement,
      requiredVersionNumber: state.requiredVersionNumber,
      ackSatisfied: state.ackSatisfied,
      awaitingAck: state.awaitingAck,
      wasReopened: state.wasReopened,
      lastAckedAt: state.lastAckedAt,
    });
  }

  items.sort((a, b) => (b.announcement.publishAt?.getTime() ?? 0) - (a.announcement.publishAt?.getTime() ?? 0));
  return { user: userLite, items };
}
