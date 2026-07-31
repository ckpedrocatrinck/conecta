import type { Prisma } from "@prisma/client";
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

/** Identidade injetada nos cards gerados (INC-009). Desde o INC-017 `logoUrl`
 * e' a KEY do MediaStorage (branding/{tenantId}/logo), nao mais um asset
 * publico direto — o consumidor resolve: no browser, assina via getViewUrl
 * (`signBrandingForDisplay`); no PNG exportavel, embute como data URI (satori
 * nao carrega cookie). accentColor e' texto (nao depende de R2). */
export async function findTenantBranding(tenantId: string): Promise<TenantBranding> {
  const tenant = await appDb.tenant.findUnique({
    where: { id: tenantId },
    select: { logoUrl: true, accentColor: true },
  });
  return { logoUrl: tenant?.logoUrl ?? null, accentColor: tenant?.accentColor ?? null };
}

/** Banner da home (INC-017): key do MediaStorage ou null (=> fallback fixo). */
export async function findTenantHomeBannerKey(tenantId: string): Promise<string | null> {
  const tenant = await appDb.tenant.findUnique({
    where: { id: tenantId },
    select: { homeBannerKey: true },
  });
  return tenant?.homeBannerKey ?? null;
}

/** Banner de Vagas (INC-019): key do MediaStorage ou null (=> fallback fixo
 * public/banners/vagas.png). */
export async function findTenantVagasBannerKey(tenantId: string): Promise<string | null> {
  const tenant = await appDb.tenant.findUnique({
    where: { id: tenantId },
    select: { vagasBannerKey: true },
  });
  return tenant?.vagasBannerKey ?? null;
}

/** Banner de Beneficios (INC-019): key do MediaStorage ou null (=> sem
 * imagem — HomeBanner cai no bloco de texto, nao ha asset fixo proprio). */
export async function findTenantBeneficiosBannerKey(tenantId: string): Promise<string | null> {
  const tenant = await appDb.tenant.findUnique({
    where: { id: tenantId },
    select: { beneficiosBannerKey: true },
  });
  return tenant?.beneficiosBannerKey ?? null;
}

/** Campos da tela "Aparencia da empresa" (INC-017; INC-019 estende com banner
 * por secao). Atualizacao parcial: so' grava as chaves presentes (undefined =
 * nao mexe). `logoUrl`/`homeBannerKey`/`vagasBannerKey`/`beneficiosBannerKey`
 * sao keys de storage; `accentColor` e' hex `#RRGGBB` (validado na action).
 * tenants nao tem RLS — o update passa pelo tx do withTenant so' para casar com
 * o registro de auditoria na mesma operacao. */
export type TenantAppearanceUpdate = {
  homeBannerKey?: string | null;
  vagasBannerKey?: string | null;
  beneficiosBannerKey?: string | null;
  logoUrl?: string | null;
  accentColor?: string | null;
};

export function updateTenantAppearance(
  tx: Prisma.TransactionClient,
  tenantId: string,
  data: TenantAppearanceUpdate,
) {
  return tx.tenant.update({ where: { id: tenantId }, data });
}
