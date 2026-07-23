import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { findBenefitById } from "@/lib/repositories/benefit.repository";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BENEFIT_CATEGORY_LABELS } from "@/lib/benefits/category-labels";
import { BenefitForm } from "../benefit-form";
import { deleteBenefitAction, toggleBenefitActiveAction, updateBenefitAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  obrigatorio: "Preencha categoria, parceiro, benefício e descrição.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  ativado: "Benefício ativado.",
  desativado: "Benefício desativado.",
};

export default async function BenefitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; salvo?: string; ok?: string }>;
}) {
  const session = await requireAdmin();
  const { id } = await params;
  const { erro, salvo, ok } = await searchParams;

  const benefit = await withTenant({ tenantId: session.tenantId }, (tx) => findBenefitById(tx, session.tenantId, id));
  if (!benefit) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display text-foreground">
          {benefit.partnerName}{" "}
          <span className="text-body font-normal text-muted-foreground">
            ({BENEFIT_CATEGORY_LABELS[benefit.category]} · {benefit.active ? "Ativo" : "Inativo"})
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <form action={toggleBenefitActiveAction}>
            <input type="hidden" name="id" value={benefit.id} />
            <input type="hidden" name="active" value={benefit.active ? "false" : "true"} />
            <SubmitButton variant="secondary" size="touch" pendingLabel="Salvando…">
              {benefit.active ? "Desativar" : "Ativar"}
            </SubmitButton>
          </form>
          <ConfirmDialog
            triggerLabel="Excluir"
            triggerSize="touch"
            title="Excluir benefício?"
            description="Esta ação remove o benefício definitivamente e não pode ser desfeita. Para apenas ocultá-lo do colaborador, use Desativar."
            confirmLabel="Excluir"
            action={deleteBenefitAction}
            hiddenFields={{ id: benefit.id }}
          />
        </div>
      </div>

      {erro && ERROR_MESSAGES[erro] && (
        <p role="alert" className="text-meta text-destructive">
          {ERROR_MESSAGES[erro]}
        </p>
      )}
      {salvo === "ok" && <p className="text-meta font-medium text-success">Alterações salvas.</p>}
      {ok && SUCCESS_MESSAGES[ok] && <p className="text-meta font-medium text-success">{SUCCESS_MESSAGES[ok]}</p>}

      <BenefitForm
        action={updateBenefitAction}
        submitLabel="Salvar"
        benefit={{
          id: benefit.id,
          category: benefit.category,
          partnerName: benefit.partnerName,
          title: benefit.title,
          description: benefit.description,
          location: benefit.location,
          contact: benefit.contact,
          sortOrder: benefit.sortOrder,
        }}
      />
    </div>
  );
}
