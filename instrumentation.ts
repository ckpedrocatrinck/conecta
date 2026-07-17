// Hook nativo do Next 16 — roda uma vez por processo de servidor (dev/build/
// start), antes de qualquer request. A4-3 (auditoria 2026-07): falha o boot
// caso APP_DATABASE_URL nao esteja conectando como conecta_app nao-superuser.
// QA pos-INC-012.5 (2026-07-16): falha o boot em producao fora de Vercel/CF
// sem AUTH_TRUST_HOST/AUTH_URL, senao o Auth.js quebra todo login com um
// erro generico so' quando o primeiro usuario tentar entrar (ver
// src/lib/auth/assert-trust-host.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { appDb } = await import("./src/lib/db/app-client");
  const { assertRuntimeAppRole } = await import("./src/lib/db/assert-runtime-role");
  await assertRuntimeAppRole(appDb);

  const { assertAuthTrustHostConfigured } = await import("./src/lib/auth/assert-trust-host");
  assertAuthTrustHostConfigured();
}
