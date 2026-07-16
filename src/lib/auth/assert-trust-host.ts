// Achado de QA pos-INC-012.5 (2026-07-16): Auth.js so' confia no host da
// requisicao automaticamente em dev (`NODE_ENV !== "production"`) ou quando
// detecta uma plataforma conhecida (`VERCEL`/`CF_PAGES`) — ver
// `@auth/core/lib/utils/env.js`, `config.trustHost ??= !!(AUTH_URL ??
// AUTH_TRUST_HOST ?? VERCEL ?? CF_PAGES ?? (NODE_ENV !== "production"))`.
// Fora disso, em producao, `trustHost` resolve `false` e TODO login falha
// com um erro generico de "server configuration" — devolvido como Response
// crua pelo Auth.js, antes mesmo de chamar `authorize()` (nao e' um bug do
// `authorize()`, ver `src/lib/auth/config.ts`). Na Vercel isso nunca
// acontece (`VERCEL` vem setado pela plataforma); o risco e' rodar
// on-premise/local em producao sem configurar `AUTH_TRUST_HOST`/`AUTH_URL`.
//
// Mesma filosofia do `assertRuntimeAppRole` (A4-3, `src/lib/db/assert-runtime-role.ts`):
// falhar cedo e claro no boot, nao deixar o login quebrar silenciosamente so'
// quando o primeiro usuario tentar entrar. Deliberadamente NAO reimplementa a
// logica interna do Auth.js (pode mudar entre versoes) — so' confere a
// presenca das env vars conhecidas que a biblioteca aceita hoje. E' uma rede
// de seguranca, nao uma reimplementacao.
export function assertAuthTrustHostConfigured(): void {
  if (process.env.NODE_ENV !== "production") return;

  const trusted =
    process.env.VERCEL || process.env.CF_PAGES || process.env.AUTH_TRUST_HOST || process.env.AUTH_URL;

  if (!trusted) {
    throw new Error(
      "Login vai falhar: em producao fora de Vercel/CF, o Auth.js exige " +
        "AUTH_TRUST_HOST=true ou AUTH_URL configurado (senao trustHost=false e " +
        "todo login retorna erro de configuracao). Configure antes de subir.",
    );
  }
}
