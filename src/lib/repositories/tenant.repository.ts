import { appDb } from "../db/app-client";

// tenants nao tem RLS por tenant_id (e' a raiz da hierarquia multi-tenant,
// ver comentario da migration rls_and_triggers) — leitura direta via appDb,
// sem withTenant, e' o desenho pretendido, nao um bypass acidental.

export function findActiveTenants() {
  return appDb.tenant.findMany({
    where: { status: "active" },
    select: { id: true, slug: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Tenants ativos com o prazo de retencao — base da varredura de anonimizacao
 * (INC-013 G1). Enumeracao cross-tenant legitima (tenants e' a raiz, sem RLS),
 * mesmo padrao de `findActiveTenants` usado pelo sweep de comunicados. */
export function findActiveTenantsForAnonymization() {
  return appDb.tenant.findMany({
    where: { status: "active" },
    select: { id: true, slug: true, retentionMonths: true },
    orderBy: { name: "asc" },
  });
}

export function findActiveTenantBySlug(slug: string) {
  return appDb.tenant.findFirst({
    where: { slug, status: "active" },
  });
}

/** Nome de exibicao do tenant, para a marca do header (INC-013.5, DP-13):
 * "Conecta / {nome do tenant}". Leitura direta (tenants nao tem RLS). */
export async function findTenantName(tenantId: string): Promise<string | null> {
  const tenant = await appDb.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  return tenant?.name ?? null;
}

export type TenantBranding = { logoUrl: string | null; accentColor: string | null };

/** Identidade injetada nos cards gerados (INC-009). `logoUrl` e' asset
 * publico (nao pessoal), servido direto — nao passa pelo MediaStorage
 * assinado usado para fotos de pessoa. */
export async function findTenantBranding(tenantId: string): Promise<TenantBranding> {
  const tenant = await appDb.tenant.findUnique({
    where: { id: tenantId },
    select: { logoUrl: true, accentColor: true },
  });
  return { logoUrl: tenant?.logoUrl ?? null, accentColor: tenant?.accentColor ?? null };
}
