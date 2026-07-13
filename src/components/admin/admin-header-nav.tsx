import Link from "next/link"
import { Menu } from "lucide-react"
import type { UserRole } from "@prisma/client"

const ADMIN_LINKS = [
  { href: "/admin/comunicados", label: "Comunicados" },
  { href: "/admin/posts", label: "Posts" },
  { href: "/admin/colaboradores", label: "Colaboradores" },
  { href: "/admin/filiais", label: "Filiais" },
  { href: "/pendencias", label: "Pendências" },
  { href: "/admin/auditoria", label: "Auditoria" },
]

const MANAGER_LINKS = [{ href: "/pendencias", label: "Pendências" }]

interface AdminHeaderNavProps {
  role: UserRole
}

/**
 * Menu administrativo do header (ADR-009): so' admin ve' as 6 telas; manager
 * ve' so' o acesso a Pendencias; employee nao ve' header nenhum. Colapso em
 * telas estreitas via <details> semantico (sem JS/estado client) — evita
 * reproduzir o hamburguer-de-tudo, ja' que e' so' o conjunto administrativo.
 */
export function AdminHeaderNav({ role }: AdminHeaderNavProps) {
  if (role === "employee") return null

  const links = role === "admin" ? ADMIN_LINKS : MANAGER_LINKS

  if (links.length === 1) {
    const link = links[0];
    return (
      <header className="border-b border-border bg-card px-4 py-2.5">
        <Link href={link.href} className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
          {link.label}
        </Link>
      </header>
    )
  }

  return (
    <header className="border-b border-border bg-card px-4 py-2.5">
      <nav aria-label="Administração" className="hidden items-center gap-4 sm:flex">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <details className="group sm:hidden">
        <summary className="flex min-h-12 w-fit list-none items-center gap-2 text-sm font-semibold text-foreground marker:content-none">
          <Menu className="size-5" aria-hidden="true" />
          Menu admin
        </summary>
        <nav aria-label="Administração" className="flex flex-col gap-1 pb-2 pl-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="min-h-12 py-1.5 text-sm font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </details>
    </header>
  )
}
