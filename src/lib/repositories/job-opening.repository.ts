import type { Prisma, JobStatus } from "@prisma/client";

export function findJobOpeningsByTenant(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.jobOpening.findMany({ where: { tenantId } });
}

export function findJobOpeningById(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.jobOpening.findFirst({ where: { id, tenantId } });
}

/** Lista do admin (mais recentes primeiro) — mesmo padrao de
 * findPostsForAdminList/findAuditLogsForTenant. Inclui contagem de
 * candidatos para a coluna da lista, sem precisar de query separada. */
export function findJobOpeningsForAdminList(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.jobOpening.findMany({
    where: { tenantId },
    include: { branch: { select: { name: true } }, _count: { select: { applications: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Vaga com filial para tela de edicao/detalhe. */
export function findJobOpeningWithDetails(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.jobOpening.findFirst({
    where: { id, tenantId },
    include: { branch: { select: { id: true, name: true } } },
  });
}

export type OpenJobOpeningsFilter = { branchId?: string; now?: Date };

/** Vagas visiveis ao colaborador: so' `status=open` e prazo nao vencido —
 * a mesma condicao de `isJobOpeningAcceptingApplications` (src/lib/jobs/is-open.ts),
 * aplicada aqui como filtro de listagem em vez de checagem pontual.
 * `branchId` e' filtro OPCIONAL (o colaborador escolhe recortar por filial,
 * igual a /aniversariantes) — vaga de outra filial ou geral (branchId=null)
 * continua visivel sem filtro, filial nao e' controle de acesso aqui. */
export function findOpenJobOpeningsForEmployee(
  tx: Prisma.TransactionClient,
  tenantId: string,
  filter: OpenJobOpeningsFilter = {},
) {
  const now = filter.now ?? new Date();
  return tx.jobOpening.findMany({
    where: {
      tenantId,
      status: "open",
      deadline: { gt: now },
      ...(filter.branchId ? { branchId: filter.branchId } : {}),
    },
    include: { branch: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export type NewJobOpeningData = {
  tenantId: string;
  title: string;
  description: string;
  branchId?: string | null;
  shift?: string | null;
  requirements?: string | null;
  deadline: Date;
  createdBy: string;
};

export function createJobOpening(tx: Prisma.TransactionClient, data: NewJobOpeningData) {
  return tx.jobOpening.create({
    data: {
      tenantId: data.tenantId,
      title: data.title,
      description: data.description,
      branchId: data.branchId ?? null,
      shift: data.shift ?? null,
      requirements: data.requirements ?? null,
      deadline: data.deadline,
      createdBy: data.createdBy,
      status: "open",
    },
  });
}

export type JobOpeningFieldsUpdate = {
  title: string;
  description: string;
  branchId?: string | null;
  shift?: string | null;
  requirements?: string | null;
  deadline: Date;
};

export function updateJobOpeningFields(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  data: JobOpeningFieldsUpdate,
) {
  return tx.jobOpening.updateMany({
    where: { id, tenantId },
    data: {
      title: data.title,
      description: data.description,
      branchId: data.branchId ?? null,
      shift: data.shift ?? null,
      requirements: data.requirements ?? null,
      deadline: data.deadline,
    },
  });
}

/** Fechamento manual pelo admin (ex.: vaga preenchida antes do prazo) —
 * `open -> closed`, sem caminho de volta (mesmo espirito de publishPost). O
 * fechamento por prazo vencido NAO passa por aqui: e' so' uma checagem
 * computada (isJobOpeningAcceptingApplications), o status no banco
 * continua "open" ate' um fechamento manual (decisao registrada no
 * Relatorio de Entrega do INC-011). */
export function closeJobOpeningManually(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.jobOpening.updateMany({ where: { id, tenantId, status: "open" as JobStatus }, data: { status: "closed" } });
}

/** Candidatos de uma vaga (tela admin + export CSV) — join com o
 * colaborador para nome/matricula/filial, mais recentes primeiro. */
export function findApplicantsForJobOpening(tx: Prisma.TransactionClient, tenantId: string, jobOpeningId: string) {
  return tx.jobApplication.findMany({
    where: { jobOpeningId, tenantId },
    include: { user: { select: { fullName: true, registrationCode: true, branchId: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export function findJobApplication(
  tx: Prisma.TransactionClient,
  tenantId: string,
  jobOpeningId: string,
  userId: string,
) {
  return tx.jobApplication.findFirst({ where: { jobOpeningId, userId, tenantId } });
}

export function createJobApplication(
  tx: Prisma.TransactionClient,
  tenantId: string,
  jobOpeningId: string,
  userId: string,
  note: string | null,
) {
  return tx.jobApplication.create({ data: { tenantId, jobOpeningId, userId, note } });
}

/** Cancelamento = DELETE fisico (mesmo padrao de removePostReaction) —
 * `JobApplication` nao tem coluna de status; a linha existir OU NAO e' o
 * proprio estado "candidatado". Recandidatar-se depois e' permitido, a
 * constraint unica so' impede duas linhas simultaneas. */
export function cancelJobApplication(
  tx: Prisma.TransactionClient,
  tenantId: string,
  jobOpeningId: string,
  userId: string,
) {
  return tx.jobApplication.deleteMany({ where: { jobOpeningId, userId, tenantId } });
}

/** "Minhas candidaturas" (perfil) — requisito de
 * lgpd-requisitos-tecnicos.md §Interface ("Tela 'Meus dados' mostra...
 * minhas candidaturas"). Traz a vaga junto para exibir titulo/status sem
 * N+1. */
export function findMyJobApplications(tx: Prisma.TransactionClient, tenantId: string, userId: string) {
  return tx.jobApplication.findMany({
    where: { userId, tenantId },
    include: { jobOpening: { select: { id: true, title: true, status: true, deadline: true } } },
    orderBy: { createdAt: "desc" },
  });
}
