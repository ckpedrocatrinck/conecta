import { requireAdmin } from "../../../../../lib/auth/session";
import { withTenant } from "../../../../../lib/db/with-tenant";
import { findBranchesByTenant } from "../../../../../lib/repositories/branch.repository";
import { NewAnnouncementForm } from "./form";

const ERROR_MESSAGES: Record<string, string> = {
  obrigatorio: "Preencha título, corpo, categoria e criticidade.",
};

export default async function NovoComunicadoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const session = await requireAdmin();
  const { erro } = await searchParams;
  const branches = await withTenant({ tenantId: session.tenantId }, (tx) => findBranchesByTenant(tx, session.tenantId));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-display text-foreground">Novo comunicado</h1>

      {erro && ERROR_MESSAGES[erro] && (
        <p role="alert" className="text-meta text-destructive">
          {ERROR_MESSAGES[erro]}
        </p>
      )}

      <NewAnnouncementForm branches={branches} />
    </div>
  );
}
