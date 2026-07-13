import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdmin } from "../../../../../lib/auth/session";
import { withTenant } from "../../../../../lib/db/with-tenant";
import { findBranchesByTenant } from "../../../../../lib/repositories/branch.repository";
import { findUserById } from "../../../../../lib/repositories/user.repository";
import { ResetPasswordButton } from "./reset-password-button";
import { toggleEmployeeStatusAction, updateEmployeeAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  obrigatorio: "Nome, filial e papel são obrigatórios.",
  filial: "Filial inválida.",
};

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function EditarColaboradorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const session = await requireAdmin();
  const { id } = await params;
  const { erro, sucesso } = await searchParams;

  const { user, branches } = await withTenant({ tenantId: session.tenantId }, async (tx) => ({
    user: await findUserById(tx, session.tenantId, id),
    branches: await findBranchesByTenant(tx, session.tenantId),
  }));

  if (!user) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">{user.fullName}</h1>
        <span className="text-sm text-zinc-500">{user.status === "active" ? "ativo" : "inativo"}</span>
      </div>

      <form action={updateEmployeeAction} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={user.id} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Nome completo</Label>
          <Input id="fullName" name="fullName" defaultValue={user.fullName} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="branchId">Filial</Label>
          <select
            id="branchId"
            name="branchId"
            defaultValue={user.branchId}
            required
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role">Papel</Label>
          <select
            id="role"
            name="role"
            defaultValue={user.role}
            required
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
          >
            <option value="employee">Colaborador</option>
            <option value="manager">Gestor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="birthDate">Data de nascimento</Label>
          <Input id="birthDate" name="birthDate" type="date" defaultValue={toDateInputValue(user.birthDate)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hiredAt">Data de contratação</Label>
          <Input id="hiredAt" name="hiredAt" type="date" defaultValue={toDateInputValue(user.hiredAt)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" name="phone" defaultValue={user.phone ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" defaultValue={user.email ?? ""} />
        </div>

        {erro && ERROR_MESSAGES[erro] && (
          <p role="alert" className="text-sm text-destructive">
            {ERROR_MESSAGES[erro]}
          </p>
        )}
        {sucesso && <p className="text-sm text-emerald-600 dark:text-emerald-400">Alterações salvas.</p>}

        <Button type="submit">Salvar alterações</Button>
      </form>

      <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Ações</h2>
        <ResetPasswordButton userId={user.id} />
        <form action={toggleEmployeeStatusAction}>
          <input type="hidden" name="id" value={user.id} />
          <input type="hidden" name="nextStatus" value={user.status === "active" ? "inactive" : "active"} />
          <Button type="submit" variant={user.status === "active" ? "destructive" : "secondary"} size="sm">
            {user.status === "active" ? "Desligar colaborador" : "Reativar colaborador"}
          </Button>
        </form>
      </div>
    </div>
  );
}
