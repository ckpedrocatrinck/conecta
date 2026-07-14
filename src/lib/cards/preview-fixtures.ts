import type { BirthdayCardData, JobOpeningCardData } from "./card-model";
import { toCardBranding, toCardPerson } from "./card-model";
import type { TenantBranding } from "../repositories/tenant.repository";

// Aniversariante ja tem dado real desde o INC-010 (buildBirthdayCardData em
// card-model.ts, alimentado pela query de aniversariantes). Vaga/candidatura
// (INC-011) ainda nao — nenhum PostType nem model wired ao feed. Estes
// fixtures continuam existindo so' para o template ter algo controlado pra
// renderizar na rota de preview interna (/admin/cards-preview), ex. QA visual
// de nome de 40+ caracteres — nao sao mais a UNICA fonte do template de
// aniversariante, so' uma auxiliar de teste visual.

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
