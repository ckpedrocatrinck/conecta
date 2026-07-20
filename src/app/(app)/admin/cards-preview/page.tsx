import { requireAdmin } from "../../../../lib/auth/session";
import { findTenantBranding } from "../../../../lib/repositories/tenant.repository";
import { buildBirthdayPreviewFixture, buildJobOpeningPreviewFixture } from "../../../../lib/cards/preview-fixtures";
import { CardTemplate } from "@/components/cards/templates";

/**
 * Preview interno dos templates de aniversariante e vaga (INC-009), alimentado
 * por fixtures fixas (não pelo dado real) — útil pra QA visual do template
 * isolado (ex.: nome de 40+ caracteres), sem depender de existir alguém
 * fazendo aniversário hoje no banco. Aniversariante já tem dado real desde o
 * INC-010 (ver bloco "Aniversariantes de hoje" na home e a tela
 * `/aniversariantes`) — vaga/candidatura ainda não (INC-011, fase 4).
 */
export default async function CardsPreviewPage() {
  const session = await requireAdmin();
  const branding = await findTenantBranding(session.tenantId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-display text-foreground">Preview de templates (mock)</h1>
        <p className="text-sm text-muted-foreground">
          Os cards abaixo usam dados fictícios (nomes longos, textos de teste) só para validar o template
          visual isolado — não são o card real que aparece na home/feed. Vaga ainda não tem dado real
          (candidatura é INC-011).
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
