import Papa from "papaparse";
import type { Prisma } from "@prisma/client";
import { findAnnouncementById } from "../repositories/announcement.repository";
import { findAnnouncementVersionHistory } from "../repositories/announcement-version.repository";
import { findAnnouncementAcksForAnnouncements } from "../repositories/announcement-ack.repository";
import { findUsersByTenant } from "../repositories/user.repository";
import { findBranchesByTenant } from "../repositories/branch.repository";
import { formatDateTimeSaoPaulo } from "../dates/format-datetime";
import type { PendencyScope } from "../announcements/pending-panel";

// Excel pt-BR usa ',' como separador decimal, entao o separador de lista
// padrao da localidade e' ';' — um CSV com ',' abre com tudo numa coluna so.
// O BOM UTF-8 (﻿) faz o Excel detectar UTF-8 em vez de cair no
// Windows-1252 (que quebra acentuacao) — o classico problema de CSV brasileiro.
const CSV_DELIMITER = ";";
const UTF8_BOM = "﻿";

export type AnnouncementAckExport = { filename: string; csv: string; rowCount: number };


/**
 * Log de confirmacoes de UM comunicado, para evidencia formal (LGPD). Inclui
 * desligados (o ack e' imutavel e permanece valido mesmo apos desligamento) —
 * diferente do denominador de pendencia (INC-006), que so' conta ativos.
 * `scope.branchId` (gestor) filtra pela filial ATUAL do usuario, mesma
 * convencao de `getAnnouncementPendencyDetail`. Devolve `null` nos mesmos
 * casos em que o painel de pendencias devolveria (comunicado inexistente/nao
 * requires_ack/fora do escopo do gestor).
 */
export async function buildAnnouncementAckExportCsv(
  tx: Prisma.TransactionClient,
  tenantId: string,
  announcementId: string,
  scope: PendencyScope,
  exportedAt: Date,
): Promise<AnnouncementAckExport | null> {
  const announcement = await findAnnouncementById(tx, tenantId, announcementId);
  if (!announcement) return null;
  if (announcement.criticality !== "requires_ack") return null;
  if (announcement.status !== "published" && announcement.status !== "archived") return null;

  const [versions, acks, users, branches] = await Promise.all([
    findAnnouncementVersionHistory(tx, announcementId),
    findAnnouncementAcksForAnnouncements(tx, tenantId, [announcementId]),
    findUsersByTenant(tx, tenantId),
    findBranchesByTenant(tx, tenantId),
  ]);

  const versionNumberById = new Map(versions.map((v) => [v.id, v.versionNumber]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  const scopedAcks = scope.branchId
    ? acks.filter((a) => userById.get(a.userId)?.branchId === scope.branchId)
    : acks;

  // announcement.publishAt garantido nao-nulo: exportacao so' roda para
  // status published/archived (guarda acima), e publishAnnouncement() sempre
  // grava publish_at na publicacao (INC-027 bloco 3.9). Sem essa coluna, o
  // comprovante provava a ciencia mas nao o intervalo entre a publicacao e a
  // confirmacao — metade do valor probatorio que o ADR-001 sustenta.
  const publishedAt = formatDateTimeSaoPaulo(announcement.publishAt as Date);

  const rows = [...scopedAcks]
    .sort((a, b) => a.ackedAt.getTime() - b.ackedAt.getTime())
    .map((ack) => {
      const user = userById.get(ack.userId);
      return {
        Colaborador: user?.fullName ?? "(usuário removido)",
        Matrícula: user?.registrationCode ?? "",
        Filial: user ? (branchNameById.get(user.branchId) ?? "") : "",
        Versão: versionNumberById.get(ack.versionId) ?? "",
        "Publicado em": publishedAt,
        Hash: ack.contentHashAtAck,
        "Confirmado em": formatDateTimeSaoPaulo(ack.ackedAt),
      };
    });

  const csv = UTF8_BOM + Papa.unparse(rows, { delimiter: CSV_DELIMITER });

  const codePart =
    announcement.seqNumber != null && announcement.year != null
      ? `CI-${String(announcement.seqNumber).padStart(2, "0")}-${announcement.year}`
      : "sem-numero";
  const datePart = exportedAt.toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `confirmacoes-${codePart}-${datePart}.csv`;

  return { filename, csv, rowCount: rows.length };
}
