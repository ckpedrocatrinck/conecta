// `Announcement.category` e' texto livre (o admin digita, sem enum — ver
// form em admin/comunicados/novo/form.tsx, placeholder "Ex.: RH, Segurança,
// Operações") — diferente de `Post.type`/`Benefit.category`, que sao enums
// fechados com rotulo 1:1. Por isso o mapa cobre so' os valores convencionais
// (os mesmos usados pelo seed de demonstracao) e qualquer categoria fora dele
// cai no fallback de capitalizacao — nunca exibe o valor cru em minusculas
// (achado INC-027 Bloco 3.5: comunicados mostravam "rh"/"seguranca" ao vivo,
// enquanto posts ja usavam POST_TYPE_LABEL).
const ANNOUNCEMENT_CATEGORY_LABELS: Record<string, string> = {
  rh: "RH",
  seguranca: "Segurança",
  operacional: "Operacional",
  aviso: "Aviso",
  beneficios: "Benefícios",
};

export function formatAnnouncementCategory(category: string): string {
  const known = ANNOUNCEMENT_CATEGORY_LABELS[category.trim().toLowerCase()];
  if (known) return known;
  const trimmed = category.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
