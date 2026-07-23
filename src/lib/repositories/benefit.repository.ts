import type { Prisma, BenefitCategory } from "@prisma/client";

/** Lista do admin: todos os beneficios do tenant, agrupaveis por categoria na
 * UI. Ordena por categoria, depois sortOrder, depois createdAt — mesma ordem da
 * lista do colaborador, para o admin ver exatamente como o colaborador vera'. */
export function findBenefitsForAdminList(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.benefit.findMany({
    where: { tenantId },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export function findBenefitById(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.benefit.findFirst({ where: { id, tenantId } });
}

/** Beneficios visiveis ao colaborador: so' `active=true`. Mesma ordenacao da
 * lista do admin (categoria -> sortOrder -> createdAt) — a UI agrupa por
 * categoria no accordion. */
export function findActiveBenefitsForEmployee(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.benefit.findMany({
    where: { tenantId, active: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export type NewBenefitData = {
  tenantId: string;
  category: BenefitCategory;
  partnerName: string;
  title: string;
  description: string;
  location?: string | null;
  contact?: string | null;
  sortOrder?: number;
  createdBy: string;
};

export function createBenefit(tx: Prisma.TransactionClient, data: NewBenefitData) {
  return tx.benefit.create({
    data: {
      tenantId: data.tenantId,
      category: data.category,
      partnerName: data.partnerName,
      title: data.title,
      description: data.description,
      location: data.location ?? null,
      contact: data.contact ?? null,
      sortOrder: data.sortOrder ?? 0,
      createdBy: data.createdBy,
      // logoUrl fica nulo no MVP (fase 2 / R2); active default true no schema.
    },
  });
}

export type BenefitFieldsUpdate = {
  category: BenefitCategory;
  partnerName: string;
  title: string;
  description: string;
  location?: string | null;
  contact?: string | null;
  sortOrder?: number;
};

export function updateBenefitFields(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  data: BenefitFieldsUpdate,
) {
  return tx.benefit.updateMany({
    where: { id, tenantId },
    data: {
      category: data.category,
      partnerName: data.partnerName,
      title: data.title,
      description: data.description,
      location: data.location ?? null,
      contact: data.contact ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

/** Ativar/desativar sem apagar (campo `active`) — desativado some da lista do
 * colaborador mas continua no admin. Reversivel, sem confirmacao destrutiva. */
export function setBenefitActive(tx: Prisma.TransactionClient, tenantId: string, id: string, active: boolean) {
  return tx.benefit.updateMany({ where: { id, tenantId }, data: { active } });
}

/** Remocao definitiva (hard delete) — usada pela acao com confirmacao
 * destrutiva (padrao INC-012.5). Beneficio e' conteudo de marketing do tenant,
 * nao registro juridico/append-only; deletar de vez e' aceitavel. */
export function deleteBenefit(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.benefit.deleteMany({ where: { id, tenantId } });
}
