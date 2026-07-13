import Link from "next/link";
import { requireAdmin } from "../../../../lib/auth/session";
import { withTenant } from "../../../../lib/db/with-tenant";
import { findBranchesByTenant } from "../../../../lib/repositories/branch.repository";
import { findUsersByTenant } from "../../../../lib/repositories/user.repository";

export default async function ColaboradoresPage() {
  const session = await requireAdmin();

  const { users, branches } = await withTenant({ tenantId: session.tenantId }, async (tx) => ({
    users: await findUsersByTenant(tx, session.tenantId),
    branches: await findBranchesByTenant(tx, session.tenantId),
  }));

  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Colaboradores</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/colaboradores/novo" className="text-primary underline-offset-4 hover:underline">
            Novo colaborador
          </Link>
          <Link href="/admin/colaboradores/importar" className="text-primary underline-offset-4 hover:underline">
            Importar CSV
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {users.map((user) => (
          <Link
            key={user.id}
            href={`/admin/colaboradores/${user.id}`}
            className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <span>
              {user.fullName} <span className="text-zinc-500">({user.registrationCode})</span>
            </span>
            <span className="text-zinc-500">
              {branchNameById.get(user.branchId) ?? "—"} · {user.role} · {user.status === "active" ? "ativo" : "inativo"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
