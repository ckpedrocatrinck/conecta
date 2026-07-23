import { requireAdmin } from "@/lib/auth/session";
import { BenefitForm } from "../benefit-form";
import { createBenefitAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  obrigatorio: "Preencha categoria, parceiro, benefício e descrição.",
};

export default async function NewBenefitPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  await requireAdmin();
  const { erro } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-display text-foreground">Novo benefício</h1>

      {erro && ERROR_MESSAGES[erro] && (
        <p role="alert" className="text-meta text-destructive">
          {ERROR_MESSAGES[erro]}
        </p>
      )}

      <BenefitForm action={createBenefitAction} submitLabel="Cadastrar benefício" />
    </div>
  );
}
