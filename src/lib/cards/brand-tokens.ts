// Espelho em hex puro dos tokens de src/app/globals.css (design-system.md
// §2) para uso onde CSS vars/Tailwind nao sao lidos: o renderizador satori
// (next/og) so' entende estilo inline. Qualquer mudanca de paleta precisa
// ser replicada aqui manualmente — sao poucos tokens, e a alternativa
// (parsear CSS em runtime) nao vale a complexidade neste estagio.
export const BRAND_TOKENS = {
  background: "#f4f5f3",
  card: "#ffffff",
  foreground: "#1f2422",
  mutedForeground: "#6b736e",
  subtleForeground: "#828a85",
  border: "#e3e6e2",
  primary: "#2f7a5f",
  primarySubtle: "#e7f1ec",
} as const;

/** Cor de destaque padrao quando o tenant nao tem `accentColor` configurado
 * (fallback de marca, nao decoracao — nunca usa `--action`, exclusivo de
 * acoes do usuario). */
export const DEFAULT_ACCENT_COLOR = BRAND_TOKENS.primary;
