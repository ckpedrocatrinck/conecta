"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface AdminNavLink {
  href: string
  label: string
  /** Ativo so' no match exato (ex. "Início" → /admin, que e' prefixo de tudo). */
  exact?: boolean
  /** Contagem de pendencia (laranja) — so' no item Pendencias. */
  badge?: number
}

/**
 * Trilho de navegacao do header admin B (DP-13) com indicador de secao ativa.
 * Client so' pelo `usePathname` (a autorizacao continua nos guards de rota — ver
 * comentario em `(app)/layout.tsx`); renderizado tanto na barra horizontal do
 * desktop quanto dentro do `<details>` "Menu admin" no estreito.
 */
export function AdminNavLinks({
  links,
  className,
}: {
  links: AdminNavLink[]
  className?: string
}) {
  const pathname = usePathname()

  return (
    <nav aria-label="Administração" className={cn("flex gap-1", className)}>
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
              active
                ? "bg-primary-subtle text-primary-deep"
                : "text-foreground-soft hover:bg-muted hover:text-foreground"
            )}
          >
            {link.label}
            {Boolean(link.badge) && link.badge! > 0 && (
              <Badge variant="count">{link.badge! > 9 ? "9+" : link.badge}</Badge>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
