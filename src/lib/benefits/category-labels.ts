import type { BenefitCategory } from "@prisma/client";

/** Rotulos pt-BR das categorias do Clube de Beneficios (INC-015), centralizados
 * (CLAUDE.md: strings de UI em pt-BR, centralizadas). Capitalizacao correta —
 * "Saude", "Educacao" com acento — explicitamente sem os defeitos da portal legado
 * ("SAUDE"/"SAude"). O enum no banco e' minusculo (ver BenefitCategory em
 * schema.prisma); estes sao apenas os rotulos de exibicao. */
export const BENEFIT_CATEGORY_LABELS: Record<BenefitCategory, string> = {
  saude: "Saúde",
  lazer: "Lazer",
  educacao: "Educação",
  alimentacao: "Alimentação",
  outros: "Outros",
};

/** Ordem canonica de exibicao das categorias (accordion do colaborador e lista
 * do admin). "Outros" por ultimo. */
export const BENEFIT_CATEGORY_ORDER: BenefitCategory[] = [
  "saude",
  "lazer",
  "educacao",
  "alimentacao",
  "outros",
];
