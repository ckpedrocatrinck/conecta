import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdmin } from "../../../lib/auth/session";
import { withTenant } from "../../../lib/db/with-tenant";
import { findBranchesByTenant } from "../../../lib/repositories/branch.repository";
import { createBranchAction, deleteBranchAction, updateBranchAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  obrigatorio: "Nome e código são obrigatórios.",
  duplicado: "Já existe uma filial com esse código.",
  "em-uso": "Esta filial tem colaboradores vinculados e não pode ser removida.",
};

export default async function FiliaisPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const session = await requireAdmin();
  const { erro } = await searchParams;
  const branches = await withTenant({ tenantId: session.tenantId }, (tx) => findBranchesByTenant(tx, session.tenantId));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Filiais</h1>

      {erro && ERROR_MESSAGES[erro] && (
        <p role="alert" className="text-sm text-destructive">
          {ERROR_MESSAGES[erro]}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {branches.map((branch) => (
          <form
            key={branch.id}
            action={updateBranchAction}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <input type="hidden" name="id" value={branch.id} />
            <div className="flex flex-col gap-1">
              <Label htmlFor={`name-${branch.id}`}>Nome</Label>
              <Input id={`name-${branch.id}`} name="name" defaultValue={branch.name} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`code-${branch.id}`}>Código</Label>
              <Input id={`code-${branch.id}`} name="code" defaultValue={branch.code} required className="w-24" />
            </div>
            <Button type="submit" size="sm" variant="secondary">
              Salvar
            </Button>
            <Button type="submit" size="sm" variant="destructive" formAction={deleteBranchAction}>
              Remover
            </Button>
          </form>
        ))}
      </div>

      <form action={createBranchAction} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-name">Nome da nova filial</Label>
          <Input id="new-name" name="name" required />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-code">Código</Label>
          <Input id="new-code" name="code" required className="w-24" />
        </div>
        <Button type="submit">Adicionar filial</Button>
      </form>
    </div>
  );
}
