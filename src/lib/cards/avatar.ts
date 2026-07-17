// Fallback de avatar por iniciais quando nao ha foto (sem foto ou consentimento
// desligado) — design-system.md §5: "inicial + cor derivada". A cor e'
// escolhida por hash do nome dentro de uma paleta restrita a tons de marca
// (verde + neutros) — nunca laranja, que e' exclusivo de acao (design-system
// §0, regra de ouro).
const AVATAR_PALETTE = [
  { bg: "#E7EFE9", fg: "#2F7A5F" }, // primary-subtle / primary
  { bg: "#DCE8DF", fg: "#275F4C" }, // tom mais escuro do verde (primary-deep)
  { bg: "#F1F2ED", fg: "#4A5248" }, // neutro (bg / foreground-soft)
  { bg: "#D5E2D9", fg: "#2F7A5F" },
] as const;

export function getInitial(fullName: string): string {
  return fullName.trim().charAt(0).toUpperCase() || "?";
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Determinístico: a mesma pessoa sempre cai na mesma cor, entre sessões
 * e entre a versão nativa e a versão satori do card. */
export function getAvatarColors(fullName: string): { bg: string; fg: string } {
  const index = hashString(fullName.trim().toLowerCase()) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}
