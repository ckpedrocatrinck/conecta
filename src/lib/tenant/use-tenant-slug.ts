"use client";

import { usePathname } from "next/navigation";
import { extractTenantSlug } from "./slug-path";

/**
 * Slug do tenant corrente para componentes client (INC-014 Bloco 4). Deriva do
 * 1o segmento do path — a URL sempre carrega o slug sob [slug] — reusando a
 * mesma extracao edge-safe do middleware. Funciona no SSR (usePathname devolve
 * o path da request). Server Components devem usar `session.tenantSlug` (slug
 * autoritativo do guard); este hook e' so' para o client, onde a sessao nao
 * chega como prop.
 */
export function useTenantSlug(): string {
  const pathname = usePathname();
  return extractTenantSlug(pathname) ?? "";
}
