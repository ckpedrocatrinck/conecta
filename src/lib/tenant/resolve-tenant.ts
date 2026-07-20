import { cache } from "react";
import { findActiveTenantBySlug } from "../repositories/tenant.repository";

// Resolucao AUTORITATIVA slug -> tenant (camada Node, ADR-010 §2 corrigido).
// E' aqui — nao no middleware Edge — que o slug da URL vira um tenantId de
// verdade, consultando o banco. O boundary [slug] (Server Component, INC-014
// Bloco 4) chama isto e, se vier null, dispara notFound() (404 "empresa nao
// encontrada") SEM nunca listar tenants. `tenants` nao tem RLS (raiz da
// hierarquia, ADR-003) — leitura direta via appDb pelo repositorio e' o
// desenho pretendido.

export type ResolvedTenant = { id: string; slug: string; name: string };

async function resolve(slug: string): Promise<ResolvedTenant | null> {
  const tenant = await findActiveTenantBySlug(slug);
  if (!tenant) return null;
  return { id: tenant.id, slug: tenant.slug, name: tenant.name };
}

/**
 * Versao memoizada por request (React `cache`): o layout do [slug] e a pagina
 * resolvem o mesmo slug independentemente; `cache` garante uma unica consulta
 * por navegacao (mesmo padrao de getActiveSession). Usar esta nas Server
 * Components/route handlers.
 */
export const getTenantBySlug = cache(resolve);

/**
 * Versao SEM cache — para testes e chamadas fora de um contexto de request do
 * React (onde o dispatcher de `cache` nao existe). Mesma logica de resolucao.
 */
export const resolveTenantBySlug = resolve;
