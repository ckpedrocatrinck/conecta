import type { Prisma } from "@prisma/client";
import { appDb } from "./app-client";

export type TenantContext = {
  tenantId: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Camada de acesso — 1a linha de defesa multi-tenant (ADR-003). Abre uma
 * transacao no client `conecta_app` e configura `app.tenant_id` (via
 * set_config, escopado a transacao — `true` = igual a SET LOCAL, nunca
 * vaza para outras conexoes do pool) ANTES de rodar o callback. A RLS do
 * Postgres (2a linha de defesa) usa essa variavel de sessao nas policies.
 *
 * Repositorios devem usar SOMENTE o `tx` recebido aqui, nunca importar um
 * PrismaClient global — senao a query roda fora do contexto de tenant.
 */
export async function withTenant<T>(
  context: TenantContext,
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!UUID_RE.test(context.tenantId)) {
    throw new Error(`withTenant: tenantId invalido: "${context.tenantId}"`);
  }

  return appDb.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.tenant_id', ${context.tenantId}, true)`;
      return callback(tx);
    },
    { maxWait: 5000, timeout: 10000 },
  );
}
