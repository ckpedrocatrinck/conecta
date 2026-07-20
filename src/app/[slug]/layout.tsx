import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant/resolve-tenant";

// Liga o manifest PADRAO por tenant (/{slug}/manifest) neste subtree,
// sobrescrevendo o link global do manifest.ts institucional (INC-014 Bloco 4).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { manifest: `/${slug}/manifest` };
}

// Boundary Node do tenant (ADR-010 §2 corrigido / INC-014). Resolucao
// AUTORITATIVA do slug da URL -> tenant, no servidor com acesso a banco: slug
// inexistente/inativo -> notFound() (404 "empresa nao encontrada", ver
// not-found.tsx), NUNCA vazando a lista de tenants. Cobre todo o subtree
// /{slug}/** — hoje o login (Bloco 2); no Bloco 3 ganha a validacao de vinculo
// sessao<->tenant; no Bloco 4 passa a hospedar as rotas do produto.
//
// A barreira de isolamento continua sendo withTenant + RLS a jusante — este
// layout so' define QUAL tenant a URL designa (a fonte), nao afrouxa nada.
export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  return children;
}
