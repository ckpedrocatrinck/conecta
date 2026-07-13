import { requireAdmin } from "../../../../lib/auth/session";
import { findTenantBranding } from "../../../../lib/repositories/tenant.repository";
import { buildBirthdayPreviewFixture, buildJobOpeningPreviewFixture } from "../../../../lib/cards/preview-fixtures";
import { CardTemplate } from "@/components/cards/templates";

/**
 * Preview interno dos templates de aniversariante e vaga (INC-009) — tipos
 * sem dado real ainda (aniversariantes é INC-010; vagas/candidatura é
 * INC-011, fase 4). Alimentado só por fixtures — quando esses INCs
 * chegarem, os templates aqui já estão prontos, só troca a fonte do dado.
 */
export default async function CardsPreviewPage() {
  const session = await requireAdmin();
  const branding = await findTenantBranding(session.tenantId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Preview de templates (mock)</h1>
        <p className="text-sm text-muted-foreground">
          Aniversariante e vaga ainda não têm dado real (INC-010/INC-011) — os cards abaixo usam dados fictícios
          só para validar o template visual.
        </p>
      </div>

      <div className="flex max-w-md flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aniversariante</p>
        <CardTemplate data={buildBirthdayPreviewFixture(branding)} />
      </div>

      <div className="flex max-w-md flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vaga</p>
        <CardTemplate data={buildJobOpeningPreviewFixture(branding)} />
      </div>
    </div>
  );
}
