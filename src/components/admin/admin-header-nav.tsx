import Link from "next/link"
import { LogOut, Menu } from "lucide-react"
import type { UserRole } from "@prisma/client"

import { signOut } from "@/lib/auth/config"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { AdminNavLinks, type AdminNavLink } from "./admin-nav-links"

/** Dados de apresentacao do header (nome/filial/tenant + contagem de
 * supervisao de pendencias). Montados no `(app)/layout.tsx` a partir de
 * repositorios de leitura — nenhuma logica de dominio vive aqui. */
export interface AdminHeaderData {
  userName: string
  roleLabel: string
  branchName: string | null
  tenantName: string | null
  /** Comunicados com pendencia em aberto (visao de supervisao do RH). */
  pendingCount: number
}

interface AdminHeaderNavProps {
  role: UserRole
  data: AdminHeaderData | null
  /** Slug do tenant corrente (autoritativo, do guard no layout) — prefixa todos
   * os links do header. INC-014 Bloco 4. */
  slug: string
}

// Caminhos relativos ao tenant; o slug e' prefixado em runtime (ver componente).
type AdminNavPath = { path: string; label: string; exact?: boolean }
const ADMIN_NAV_PATHS: AdminNavPath[] = [
  { path: "/admin", label: "Início", exact: true },
  { path: "/admin/comunicados", label: "Comunicados" },
  { path: "/admin/posts", label: "Posts" },
  { path: "/admin/vagas", label: "Vagas" },
  { path: "/admin/colaboradores", label: "Colaboradores" },
  { path: "/admin/filiais", label: "Filiais" },
  { path: "/pendencias", label: "Pendências" },
  { path: "/admin/auditoria", label: "Auditoria" },
]

/**
 * Header admin B (DP-13, INC-013.5): marca à esquerda, trilho de navegação com
 * seção ativa (badge de pendências laranja), identidade do usuário + Sair à
 * direita. Resolve o header pobre, o logout sumido e a falta de identidade
 * (auditoria de usabilidade). `employee` não vê header — a autorização de rota
 * continua nos guards (requireAdmin/requireAdminOrManager); este componente só
 * decide o que aparece.
 */
export function AdminHeaderNav({ role, data, slug }: AdminHeaderNavProps) {
  if (role === "employee" || !data) return null

  const isAdmin = role === "admin"
  const homeHref = isAdmin ? `/${slug}/admin` : `/${slug}/pendencias`
  const basePaths: AdminNavPath[] = isAdmin
    ? ADMIN_NAV_PATHS
    : [{ path: "/pendencias", label: "Pendências" }]
  // Prefixa cada caminho com o slug do tenant; badge de pendencias so' no item
  // Pendencias.
  const links: AdminNavLink[] = basePaths.map((p) => ({
    href: `/${slug}${p.path}`,
    label: p.label,
    exact: p.exact,
    ...(p.path === "/pendencias" ? { badge: data.pendingCount } : {}),
  }))

  async function handleSignOut() {
    "use server"
    await signOut({ redirectTo: `/${slug}/login` })
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="flex items-center justify-between gap-4 px-4 py-2.5">
        {/* Marca */}
        <Link href={homeHref} className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary text-lg font-extrabold text-primary-foreground">
            C
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-extrabold text-foreground">Conecta</span>
            {data.tenantName && (
              <span className="text-xs text-muted-foreground">{data.tenantName}</span>
            )}
          </span>
        </Link>

        {/* Nav horizontal (desktop) */}
        <AdminNavLinks links={links} className="hidden items-center md:flex" />

        {/* Identidade + Sair */}
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="hidden flex-col items-end leading-tight sm:flex">
            <span className="text-sm font-semibold text-foreground">{data.userName}</span>
            <span className="text-xs text-muted-foreground">
              {data.roleLabel}
              {data.branchName ? ` · ${data.branchName}` : ""}
            </span>
          </div>
          <Avatar name={data.userName} size="sm" />
          <form action={handleSignOut}>
            <Button type="submit" variant="ghost" size="icon" aria-label="Sair da conta">
              <LogOut aria-hidden="true" />
            </Button>
          </form>
        </div>
      </div>

      {/* Nav colapsada (estreito): admin acessa as telas via este menu */}
      <details className="group border-t border-border px-4 md:hidden">
        <summary className="flex min-h-12 list-none items-center gap-2 text-sm font-semibold text-foreground marker:content-none">
          <Menu className="size-5" aria-hidden="true" />
          Menu admin
        </summary>
        <AdminNavLinks links={links} className="flex-col pb-2" />
      </details>
    </header>
  )
}
