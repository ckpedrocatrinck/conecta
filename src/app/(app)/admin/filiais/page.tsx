import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "../../../../lib/auth/session";
import { withTenant } from "../../../../lib/db/with-tenant";
import { findBranchesByTenant } from "../../../../lib/repositories/branch.repository";
import { findUsersByTenant } from "../../../../lib/repositories/user.repository";
import { createBranchAction, deleteBranchAction, updateBranchAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  obrigatorio: "Nome e código são obrigatórios.",
  duplicado: "Já existe uma filial com esse código.",
  "em-uso": "Esta filial tem colaboradores vinculados e não pode ser removida.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  criada: "Filial criada.",
  atualizada: "Filial atualizada.",
  removida: "Filial removida.",
};

export default async function FiliaisPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const session = await requireAdmin();
  const { erro, ok } = await searchParams;
  const { branches, users } = await withTenant({ tenantId: session.tenantId }, async (tx) => ({
    branches: await findBranchesByTenant(tx, session.tenantId),
    users: await findUsersByTenant(tx, session.tenantId),
  }));

  const countByBranch = new Map<string, number>();
  for (const user of users) {
    if (user.status !== "active") continue;
    countByBranch.set(user.branchId, (countByBranch.get(user.branchId) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-display text-foreground">Filiais</h1>
        <p className="text-meta text-muted-foreground">Unidades da empresa para segmentar comunicados e vagas.</p>
      </div>

      {erro && ERROR_MESSAGES[erro] && (
        <p role="alert" className="text-meta text-destructive">
          {ERROR_MESSAGES[erro]}
        </p>
      )}
      {ok && SUCCESS_MESSAGES[ok] && <p className="text-meta font-medium text-success">{SUCCESS_MESSAGES[ok]}</p>}

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-[2fr_1fr_1.5fr_auto] gap-4 border-b border-border px-4 py-3 text-label uppercase text-subtle-foreground">
          <span>Nome</span>
          <span>Código</span>
          <span>Colaboradores</span>
          <span aria-hidden="true" />
        </div>
        <div className="divide-y divide-border">
          {branches.map((branch) => {
            const count = countByBranch.get(branch.id) ?? 0;
            return (
              <details key={branch.id} className="group">
                <summary className="grid cursor-pointer grid-cols-[2fr_1fr_1.5fr_auto] items-center gap-4 px-4 py-3 text-body transition-colors [&::-webkit-details-marker]:hidden hover:bg-muted">
                  <span className="font-semibold text-foreground">{branch.name}</span>
                  <span className="text-meta text-muted-foreground">{branch.code}</span>
                  <span className="text-meta text-muted-foreground">
                    {count} colaborador{count !== 1 ? "es" : ""}
                  </span>
                  <span className="justify-self-end text-meta font-semibold text-primary">
                    <span className="group-open:hidden">Editar</span>
                    <span className="hidden group-open:inline">Fechar</span>
                  </span>
                </summary>
                <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border bg-muted/40 px-4 py-4">
                  <form action={updateBranchAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={branch.id} />
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`name-${branch.id}`}>Nome</Label>
                      <Input id={`name-${branch.id}`} name="name" defaultValue={branch.name} required />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`code-${branch.id}`}>Código</Label>
                      <Input id={`code-${branch.id}`} name="code" defaultValue={branch.code} required className="w-24" />
                    </div>
                    <SubmitButton size="touch" variant="secondary" pendingLabel="Salvando…">
                      Salvar
                    </SubmitButton>
                  </form>
                  <ConfirmDialog
                    triggerLabel="Remover filial"
                    triggerSize="touch"
                    title="Remover esta filial?"
                    description="Só é possível remover filiais sem colaboradores vinculados. Esta ação não pode ser desfeita."
                    confirmLabel="Remover"
                    action={deleteBranchAction}
                    hiddenFields={{ id: branch.id }}
                  />
                </div>
              </details>
            );
          })}
        </div>
      </div>

      <form
        action={createBranchAction}
        className="flex flex-wrap items-end gap-2 rounded-[var(--radius-card)] border border-dashed border-border-strong p-4"
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-name">Nome da nova filial</Label>
          <Input id="new-name" name="name" required />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-code">Código</Label>
          <Input id="new-code" name="code" required className="w-24" />
        </div>
        <SubmitButton size="touch" pendingLabel="Adicionando…">Adicionar filial</SubmitButton>
      </form>
    </div>
  );
}
