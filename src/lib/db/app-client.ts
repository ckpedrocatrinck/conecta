import { PrismaClient } from "@prisma/client";

// Client de runtime da aplicacao — conecta como `conecta_app` (role
// nao-superuser, ver prisma/migrations/*_rls_and_triggers), nao a role
// owner usada por `prisma migrate`/seed. So' assim a RLS por tenant_id
// (ADR-003) e' real: superuser sempre ignora RLS, mesmo com
// FORCE ROW LEVEL SECURITY.

declare global {
  var __conectaAppDb: PrismaClient | undefined;
}

function createAppDbClient(): PrismaClient {
  const url = process.env.APP_DATABASE_URL;
  if (!url) {
    throw new Error("APP_DATABASE_URL nao configurada");
  }
  return new PrismaClient({ datasourceUrl: url });
}

export const appDb = globalThis.__conectaAppDb ?? createAppDbClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__conectaAppDb = appDb;
}
