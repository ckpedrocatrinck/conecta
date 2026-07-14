import type { TenantBranding } from "../repositories/tenant.repository";
import { buildJobOpeningCardData, type JobOpeningCardData } from "../cards/card-model";

export type JobOpeningRow = {
  title: string;
  description: string;
  shift: string | null;
  deadline: Date;
  branch: { name: string } | null;
};

/** Mapeia a linha do banco (job-opening.repository.ts, com `branch` incluso)
 * para o `JobOpeningCardData` consumido pelo template do INC-009 — mesmo
 * papel de buildTodaysBirthdayCards para aniversariante, so' sem precisar
 * de tratamento de consentimento (vaga nao tem dado pessoal de terceiro). */
export function jobOpeningToCardData(job: JobOpeningRow, branding: TenantBranding): JobOpeningCardData {
  return buildJobOpeningCardData(
    {
      title: job.title,
      description: job.description,
      shift: job.shift,
      deadline: job.deadline.toISOString(),
      branchName: job.branch?.name ?? null,
    },
    branding,
  );
}

export type ApplicantRow = {
  userId: string;
  note: string | null;
  createdAt: Date;
  user: { fullName: string; registrationCode: string; branchId: string };
};

export type ApplicantView = {
  userId: string;
  fullName: string;
  registrationCode: string;
  branchName: string;
  note: string | null;
  createdAt: Date;
};

/** Vista da lista de candidatos (tela admin + export CSV) — resolve o nome
 * da filial a partir de um mapa ja carregado por quem chama (mesmo padrao
 * de branchNameById em announcement-ack-export.ts), evita N+1. */
export function toApplicantView(applicant: ApplicantRow, branchNameById: Map<string, string>): ApplicantView {
  return {
    userId: applicant.userId,
    fullName: applicant.user.fullName,
    registrationCode: applicant.user.registrationCode,
    branchName: branchNameById.get(applicant.user.branchId) ?? "",
    note: applicant.note,
    createdAt: applicant.createdAt,
  };
}
