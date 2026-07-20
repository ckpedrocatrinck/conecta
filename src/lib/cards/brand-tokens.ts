// Espelho em hex puro dos tokens de src/app/globals.css (design-system.md
// §2) para uso onde CSS vars/Tailwind nao sao lidos: o renderizador satori
// (next/og) so' entende estilo inline. Qualquer mudanca de paleta precisa
// ser replicada aqui manualmente — sao poucos tokens, e a alternativa
// (parsear CSS em runtime) nao vale a complexidade neste estagio.
export const BRAND_TOKENS = {
  background: "#f1f2ed",
  card: "#ffffff",
  foreground: "#20261f",
  mutedForeground: "#6b7469",
  subtleForeground: "#8a9187",
  border: "#e3e6de",
  primary: "#2f7a5f",
  primaryDeep: "#275f4c",
  primarySubtle: "#e7efe9",
} as const;

/** Card EXPORTÁVEL (PNG do WhatsApp, INC-013.5, direção "campo verde-profundo
 * denso"). Só o card baixável usa este esquema escuro — o card do feed in-app
 * segue calmo/claro (design-system §4). Valores conferidos para contraste AA
 * de texto sobre o verde-profundo `#22513f`. */
export const CARD_EXPORT_TOKENS = {
  surface: "#22513f",
  surfaceRaised: "rgba(255,255,255,0.10)",
  onSurface: "#ffffff",
  onSurfaceMuted: "#cfe0d8",
  onSurfaceSubtle: "#9fbaad",
  motif: "#ffffff",
} as const;

/** Cor de destaque padrao quando o tenant nao tem `accentColor` configurado
 * (fallback de marca, nao decoracao — nunca usa `--action`, exclusivo de
 * acoes do usuario). */
export const DEFAULT_ACCENT_COLOR = BRAND_TOKENS.primary;
