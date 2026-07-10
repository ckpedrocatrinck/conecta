import { requireAdmin } from "../../../../lib/auth/session";
import { withTenant } from "../../../../lib/db/with-tenant";
import { findBranchesByTenant } from "../../../../lib/repositories/branch.repository";
import { NewEmployeeForm } from "./form";

export default async function NovoColaboradorPage() {
  const session = await requireAdmin();
  const branches = await withTenant({ tenantId: session.tenantId }, (tx) => findBranchesByTenant(tx, session.tenantId));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Novo colaborador</h1>
      <NewEmployeeForm branches={branches} />
    </div>
  );
}
