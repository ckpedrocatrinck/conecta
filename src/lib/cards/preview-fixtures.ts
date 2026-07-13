import type { BirthdayCardData, JobOpeningCardData } from "./card-model";
import { toCardBranding, toCardPerson } from "./card-model";
import type { TenantBranding } from "../repositories/tenant.repository";

// Aniversariante (INC-010) e vaga/candidatura (INC-011) ainda nao tem dado
// real — nenhum PostType nem model wired ao feed. Estes fixtures existem so'
// para o template ter algo pra renderizar na rota de preview interna
// (/admin/cards-preview). Quando os INCs correspondentes chegarem, os
// templates em src/components/cards/templates ja estao prontos — so' trocar
// a fonte do dado por um mapper real, no mesmo padrao de buildPostCardData.

export function buildBirthdayPreviewFixture(branding: TenantBranding): BirthdayCardData {
  return {
    kind: "birthday",
    person: toCardPerson({ fullName: "Maria Aparecida dos Santos Oliveira Nascimento", photoUrl: null }),
    eventDate: new Date().toISOString(),
    branding: toCardBranding(branding),
  };
}

export function buildJobOpeningPreviewFixture(branding: TenantBranding): JobOpeningCardData {
  return {
    kind: "job_opening",
    title: "Auxiliar de estoque",
    description: "Vaga para o turno da tarde, filial Centro. Experiência prévia não obrigatória.",
    shift: "Tarde",
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    branchName: "Filial Centro",
    branding: toCardBranding(branding),
  };
}
