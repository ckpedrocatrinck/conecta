import { cache } from "react";
import type { Announcement, AnnouncementVersion, Prisma } from "@prisma/client";
import { withTenant } from "../db/with-tenant";
import { findVisibleAnnouncementIdsForUser, searchAnnouncementIds } from "../repositories/announcement.repository";
import { findAnnouncementVersionsForAnnouncements } from "../repositories/announcement-version.repository";
import { findAnnouncementReadsForUser } from "../repositories/announcement-read.repository";
import { findAnnouncementAcksForUser } from "../repositories/announcement-ack.repository";
import { buildAnnouncementReaderState, type AnnouncementReaderState } from "./reader-state";

export type AnnouncementListItem = {
  announcement: Announcement;
  latestVersion: AnnouncementVersion;
  state: AnnouncementReaderState<AnnouncementVersion>;
};

function groupByAnnouncementId<T extends { announcementId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = map.get(row.announcementId);
    if (bucket) bucket.push(row);
    else map.set(row.announcementId, [row]);
  }
  return map;
}

/**
 * Lista de comunicados visiveis a um colaborador, com estado (Novo /
 * Confirmar leitura / Confirmado|Lido) calculado por anuncio. Busca 4 queries
 * no total (nao O(N) por anuncio): audiencia/visibilidade (ja existente do
 * INC-004), versoes, leituras e acks do usuario em lote.
 */
export async function listAnnouncementsForUser(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  opts: { q?: string; category?: string } = {},
): Promise<{ items: AnnouncementListItem[]; categories: string[] }> {
  const visibleIds = await findVisibleAnnouncementIdsForUser(tx, tenantId, userId);
  if (visibleIds.length === 0) return { items: [], categories: [] };

  const q = opts.q?.trim();
  const searchMatchIds = q ? new Set(await searchAnnouncementIds(tx, tenantId, q)) : null;
  const filteredIds = searchMatchIds ? visibleIds.filter((id) => searchMatchIds.has(id)) : visibleIds;
  if (filteredIds.length === 0) return { items: [], categories: [] };

  const [announcements, versions, reads, acks] = await Promise.all([
    tx.announcement.findMany({ where: { tenantId, id: { in: filteredIds } } }),
    findAnnouncementVersionsForAnnouncements(tx, filteredIds),
    findAnnouncementReadsForUser(tx, tenantId, userId, filteredIds),
    findAnnouncementAcksForUser(tx, tenantId, userId, filteredIds),
  ]);

  const versionsByAnnouncement = groupByAnnouncementId(versions);
  const readsByAnnouncement = groupByAnnouncementId(reads);
  const acksByAnnouncement = groupByAnnouncementId(acks);

  const allItems: AnnouncementListItem[] = announcements.map((announcement) => {
    const versionsForAnnouncement = versionsByAnnouncement.get(announcement.id) ?? [];
    const state = buildAnnouncementReaderState({
      criticality: announcement.criticality,
      versions: versionsForAnnouncement,
      reads: readsByAnnouncement.get(announcement.id) ?? [],
      acks: acksByAnnouncement.get(announcement.id) ?? [],
    });
    return { announcement, latestVersion: state.latestVersion, state };
  });

  const categories = Array.from(new Set(allItems.map((i) => i.announcement.category))).sort();

  const items = opts.category ? allItems.filter((i) => i.announcement.category === opts.category) : allItems;

  items.sort((x, y) => {
    const xUnread = x.state.badge === "novo" || x.state.badge === "confirmar_leitura";
    const yUnread = y.state.badge === "novo" || y.state.badge === "confirmar_leitura";
    if (xUnread !== yUnread) return xUnread ? -1 : 1;
    const xDate = x.announcement.publishAt?.getTime() ?? 0;
    const yDate = y.announcement.publishAt?.getTime() ?? 0;
    return yDate - xDate;
  });

  return { items, categories };
}

export async function countPendingAcksForUser(tx: Prisma.TransactionClient, tenantId: string, userId: string): Promise<number> {
  const { items } = await listAnnouncementsForUser(tx, tenantId, userId);
  return items.filter((i) => i.state.awaitingAck).length;
}

/**
 * Mesma contagem de `countPendingAcksForUser`, envolvida em `cache()` (React)
 * e ja' abrindo a transacao — usada pelo badge de pendencia da navegacao
 * (INC-008.5) e pela home. `cache()` deduplica por (tenantId, userId) dentro
 * do mesmo request, entao layout + pagina dividem uma unica consulta.
 */
export const getCachedPendingAckCount = cache(async (tenantId: string, userId: string): Promise<number> => {
  return withTenant({ tenantId }, (tx) => countPendingAcksForUser(tx, tenantId, userId));
});
