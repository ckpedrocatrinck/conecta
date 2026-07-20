"use client"

import { usePathname } from "next/navigation"
import { Briefcase, Home, Megaphone, User } from "lucide-react"
import type { UserRole } from "@prisma/client"

import { BottomNav, type BottomNavItem } from "@/components/ui/bottom-nav"
import { useTenantSlug } from "@/lib/tenant/use-tenant-slug"

interface AppBottomNavProps {
  pendingCount: number
  role: UserRole
}

/**
 * Itens fixos do ADR-009 (Inicio/Comunicados/Vagas/Perfil, todos os papeis —
 * Vagas e' o 4o item, previsto desde o ADR-009 e entregue no INC-011).
 * Ficam aqui (client) e nao vem do servidor porque componentes de icone
 * (funcoes) nao atravessam a fronteira Server->Client como prop serializavel.
 * INC-014: todos os links sao tenant-scoped (`/${slug}/...`).
 */
function buildItems(slug: string, pendingCount: number): BottomNavItem[] {
  return [
    { href: `/${slug}`, label: "Início", icon: Home },
    { href: `/${slug}/comunicados`, label: "Comunicados", icon: Megaphone, badge: pendingCount },
    { href: `/${slug}/vagas`, label: "Vagas", icon: Briefcase },
    { href: `/${slug}/perfil`, label: "Perfil", icon: User },
  ]
}

export function AppBottomNav({ pendingCount, role }: AppBottomNavProps) {
  const pathname = usePathname()
  const slug = useTenantSlug()
  // DP-13: admin/manager navegam pelo header B no desktop (≥640px); a bottom
  // nav some pra eles nessa largura. O colaborador (mobile-first) mantém a
  // bottom nav em qualquer largura — nunca fica sem navegação (ele não vê o
  // header admin).
  const hideOnDesktop = role !== "employee"
  return (
    <BottomNav
      items={buildItems(slug, pendingCount)}
      activeHref={pathname}
      className={hideOnDesktop ? "sm:hidden" : undefined}
    />
  )
}
