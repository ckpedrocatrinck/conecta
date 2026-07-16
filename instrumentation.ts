// Hook nativo do Next 16 — roda uma vez por processo de servidor (dev/build/
// start), antes de qualquer request. A4-3 (auditoria 2026-07): falha o boot
// caso APP_DATABASE_URL nao esteja conectando como conecta_app nao-superuser.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { appDb } = await import("./src/lib/db/app-client");
  const { assertRuntimeAppRole } = await import("./src/lib/db/assert-runtime-role");
  await assertRuntimeAppRole(appDb);
}
