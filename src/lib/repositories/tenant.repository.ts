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

export function findActiveTenantBySlug(slug: string) {
  return appDb.tenant.findFirst({
    where: { slug, status: "active" },
  });
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
