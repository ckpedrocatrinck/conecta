import Papa from "papaparse";
import type { Prisma } from "@prisma/client";
import { findJobOpeningById, findApplicantsForJobOpening } from "../repositories/job-opening.repository";
import { findBranchesByTenant } from "../repositories/branch.repository";
import { toApplicantView } from "../jobs/build-job-opening-view";
import { formatDateTimeSaoPaulo } from "../dates/format-datetime";

// Mesma convencao de announcement-ack-export.ts: ';' (Excel pt-BR usa ','
// como separador decimal) + BOM UTF-8 (evita o Excel cair em Windows-1252).
const CSV_DELIMITER = ";";
const UTF8_BOM = "﻿";

export type JobApplicationExport = { filename: string; csv: string; rowCount: number };

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Candidatos de UMA vaga, para o admin exportar (INC-011). Admin-only, sem
 * escopo de filial (decisao do INC-011: vaga nao tem visibilidade de
 * candidatos por manager, ver ADR-009 — so' Pendencias e' tela do
 * manager). Devolve null se a vaga nao existir neste tenant.
 */
export async function buildJobApplicationExportCsv(
  tx: Prisma.TransactionClient,
  tenantId: string,
  jobOpeningId: string,
  exportedAt: Date,
): Promise<JobApplicationExport | null> {
  const job = await findJobOpeningById(tx, tenantId, jobOpeningId);
  if (!job) return null;

  const [applicants, branches] = await Promise.all([
    findApplicantsForJobOpening(tx, tenantId, jobOpeningId),
    findBranchesByTenant(tx, tenantId),
  ]);

  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  const rows = applicants
    .map((a) => toApplicantView(a, branchNameById))
    .map((a) => ({
      Colaborador: a.fullName,
      Matrícula: a.registrationCode,
      Filial: a.branchName,
      Telefone: a.phone ?? "",
      "Candidatura em": formatDateTimeSaoPaulo(a.createdAt),
      Observação: a.note ?? "",
    }));

  const csv = UTF8_BOM + Papa.unparse(rows, { delimiter: CSV_DELIMITER });

  const datePart = exportedAt.toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `candidatos-${slugify(job.title) || jobOpeningId}-${datePart}.csv`;

  return { filename, csv, rowCount: rows.length };
}
