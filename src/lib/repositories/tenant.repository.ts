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
