"use client"

import { usePathname } from "next/navigation"
import { Home, Megaphone, User } from "lucide-react"

import { BottomNav, type BottomNavItem } from "@/components/ui/bottom-nav"

interface AppBottomNavProps {
  pendingCount: number
}

/**
 * Itens fixos do ADR-009 (Inicio/Comunicados/Perfil, todos os papeis).
 * Ficam aqui (client) e nao vem do servidor porque componentes de icone
 * (funcoes) nao atravessam a fronteira Server->Client como prop serializavel.
 */
function buildItems(pendingCount: number): BottomNavItem[] {
  return [
    { href: "/", label: "Início", icon: Home },
    { href: "/comunicados", label: "Comunicados", icon: Megaphone, badge: pendingCount },
    { href: "/perfil", label: "Perfil", icon: User },
  ]
}

export function AppBottomNav({ pendingCount }: AppBottomNavProps) {
  const pathname = usePathname()
  return <BottomNav items={buildItems(pendingCount)} activeHref={pathname} />
}
