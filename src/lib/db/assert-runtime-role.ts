import type { PrismaClient } from "@prisma/client";

// A4-3 (auditoria 2026-07): toda a defesa RLS/grant (ADR-003) e a
// imutabilidade por grant (A4-1) dependem de APP_DATABASE_URL apontar para
// `conecta_app` nao-superuser — superuser SEMPRE ignora RLS/FORCE ROW LEVEL
// SECURITY. Um erro de env silencioso apontando pra role owner tornaria
// tudo isso decorativo sem nada detectar. Chamada no boot real via
// instrumentation.ts; extraida aqui para ser testavel direto (vitest nao
// dispara instrumentation.ts).
export async function assertRuntimeAppRole(db: PrismaClient): Promise<void> {
  const [row] = await db.$queryRaw<{ current_user: string; rolsuper: boolean }[]>`
    SELECT current_user, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS rolsuper
  `;

  if (row.current_user !== "conecta_app" || row.rolsuper) {
    throw new Error(
      `APP_DATABASE_URL nao esta conectando como 'conecta_app' nao-superuser ` +
        `(current_user=${row.current_user}, rolsuper=${row.rolsuper}). RLS por tenant ` +
        `(ADR-003) e a imutabilidade por grant (announcement_acks/announcement_versions/audit_logs) ` +
        `ficam decorativas nessa condicao — corrija APP_DATABASE_URL antes de iniciar.`,
    );
  }
}
