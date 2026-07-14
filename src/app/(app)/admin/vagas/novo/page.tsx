import { requireAdmin } from "../../../../../lib/auth/session";
import { withTenant } from "../../../../../lib/db/with-tenant";
import { findBranchesByTenant } from "../../../../../lib/repositories/branch.repository";
import { NewJobOpeningForm } from "./form";

const ERROR_MESSAGES: Record<string, string> = {
  obrigatorio: "Preencha cargo, descrição e prazo.",
};

export default async function NewJobOpeningPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const session = await requireAdmin();
  const { erro } = await searchParams;

  const branches = await withTenant({ tenantId: session.tenantId }, (tx) => findBranchesByTenant(tx, session.tenantId));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Nova vaga</h1>

      {erro && ERROR_MESSAGES[erro] && (
        <p role="alert" className="text-sm text-destructive">
          {ERROR_MESSAGES[erro]}
        </p>
      )}

      <NewJobOpeningForm branches={branches} />
    </div>
  );
}
