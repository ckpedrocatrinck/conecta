import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { findBranchesByTenant } from "@/lib/repositories/branch.repository";
import { findUsersByTenant } from "@/lib/repositories/user.repository";
import { USER_ROLE_LABELS } from "@/lib/users/role-labels";
import type { UserRole } from "@prisma/client";

/** Papel em verde/neutro (correção do laranja): Admin escuro, Gestor tint,
 * Colaborador neutro — nunca laranja (não é ação). */
const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  admin: "bg-primary-deep text-primary-foreground",
  manager: "bg-primary-subtle text-primary-deep",
  employee: "border border-border-strong text-muted-foreground",
};

export default async function ColaboradoresPage() {
  const session = await requireAdmin();

  const { users, branches } = await withTenant({ tenantId: session.tenantId }, async (tx) => ({
    users: await findUsersByTenant(tx, session.tenantId),
    branches: await findBranchesByTenant(tx, session.tenantId),
  }));

  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
  const activeCount = users.filter((u) => u.status === "active").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-display text-foreground">Colaboradores</h1>
          <p className="text-meta text-muted-foreground">
            {activeCount} ativo{activeCount !== 1 ? "s" : ""} · {branches.length}{" "}
            {branches.length === 1 ? "filial" : "filiais"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/${session.tenantSlug}/admin/colaboradores/importar`} className={buttonVariants({ variant: "outline", size: "touch" })}>
            <Upload aria-hidden="true" />
            Importar CSV
          </Link>
          <Link href={`/${session.tenantSlug}/admin/colaboradores/novo`} className={buttonVariants({ variant: "default", size: "touch" })}>
            <Plus aria-hidden="true" />
            Novo colaborador
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-label uppercase text-subtle-foreground">
              <th className="px-4 py-3 font-bold">Nome</th>
              <th className="px-4 py-3 font-bold">Matrícula</th>
              <th className="px-4 py-3 font-bold">Filial</th>
              <th className="px-4 py-3 font-bold">Papel</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr key={user.id} className="text-body">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={user.fullName} size="sm" />
                    <span className="font-semibold text-foreground">{user.fullName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-meta text-muted-foreground">{user.registrationCode}</td>
                <td className="px-4 py-3 text-meta text-muted-foreground">{branchNameById.get(user.branchId) ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-label ${ROLE_BADGE_CLASS[user.role]}`}>
                    {USER_ROLE_LABELS[user.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-meta text-muted-foreground">
                    <span
                      className={`size-2 rounded-full ${user.status === "active" ? "bg-primary" : "bg-border-strong"}`}
                      aria-hidden="true"
                    />
                    {user.status === "active" ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/${session.tenantSlug}/admin/colaboradores/${user.id}`}
                    className="text-meta font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
