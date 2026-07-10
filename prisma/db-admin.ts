import type { PrismaClient } from "@prisma/client";

/**
 * Define a senha da role de runtime `conecta_app` a partir de env — nunca
 * fica em SQL versionado (a migration cria a role sem senha). Reaproveitado
 * pelo seed de dev e pelos testes de isolamento (que precisam de
 * APP_DATABASE_URL funcional independente de o seed ja ter rodado).
 * Requer `db` conectado como role owner/superuser (a mesma de
 * DATABASE_URL) — so' ela pode alterar outra role.
 */
export async function ensureAppRolePassword(db: PrismaClient) {
  const password = process.env.APP_DB_PASSWORD;
  if (!password) {
    throw new Error("APP_DB_PASSWORD nao configurada — necessaria para a role conecta_app");
  }
  // ALTER ROLE nao aceita bind parameter no protocolo do Postgres; a senha
  // vem so' de env local confiavel (nunca de input de usuario), por isso
  // escapar a aspa simples e' suficiente aqui.
  await db.$executeRawUnsafe(`ALTER ROLE conecta_app WITH PASSWORD '${password.replace(/'/g, "''")}'`);
}
