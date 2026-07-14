"use client"

import { usePathname } from "next/navigation"
import { Briefcase, Home, Megaphone, User } from "lucide-react"

import { BottomNav, type BottomNavItem } from "@/components/ui/bottom-nav"

interface AppBottomNavProps {
  pendingCount: number
}

/**
 * Itens fixos do ADR-009 (Inicio/Comunicados/Vagas/Perfil, todos os papeis —
 * Vagas e' o 4o item, previsto desde o ADR-009 e entregue no INC-011).
 * Ficam aqui (client) e nao vem do servidor porque componentes de icone
 * (funcoes) nao atravessam a fronteira Server->Client como prop serializavel.
 */
function buildItems(pendingCount: number): BottomNavItem[] {
  return [
    { href: "/", label: "Início", icon: Home },
    { href: "/comunicados", label: "Comunicados", icon: Megaphone, badge: pendingCount },
    { href: "/vagas", label: "Vagas", icon: Briefcase },
    { href: "/perfil", label: "Perfil", icon: User },
  ]
}

export function AppBottomNav({ pendingCount }: AppBottomNavProps) {
  const pathname = usePathname()
  return <BottomNav items={buildItems(pendingCount)} activeHref={pathname} />
}
