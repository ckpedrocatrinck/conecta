import { requireAdmin } from "../../../../../lib/auth/session";
import { withTenant } from "../../../../../lib/db/with-tenant";
import { findBranchesByTenant } from "../../../../../lib/repositories/branch.repository";
import { findUsersForPersonPicker } from "../../../../../lib/repositories/post.repository";
import { findTenantBranding } from "../../../../../lib/repositories/tenant.repository";
import { resolvePickablePeoplePhotos } from "../../../../../lib/posts/resolve-pickable-people";
import { NewPostForm } from "./form";

const ERROR_MESSAGES: Record<string, string> = {
  obrigatorio: "Preencha tipo, título e data do evento.",
};

export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const session = await requireAdmin();
  const { erro } = await searchParams;

  const [{ branches, people: rawPeople }, branding] = await Promise.all([
    withTenant({ tenantId: session.tenantId }, async (tx) => ({
      branches: await findBranchesByTenant(tx, session.tenantId),
      people: await findUsersForPersonPicker(tx, session.tenantId),
    })),
    findTenantBranding(session.tenantId),
  ]);
  const people = await resolvePickablePeoplePhotos(rawPeople);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-display text-foreground">Novo post</h1>

      {erro && ERROR_MESSAGES[erro] && (
        <p role="alert" className="text-meta text-destructive">
          {ERROR_MESSAGES[erro]}
        </p>
      )}

      <NewPostForm branches={branches} people={people} branding={branding} />
    </div>
  );
}
