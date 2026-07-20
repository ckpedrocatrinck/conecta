import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { findBranchesByTenant } from "@/lib/repositories/branch.repository";
import { findUserById } from "@/lib/repositories/user.repository";
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
  searchParams: Promise<{ erro?: string; sucesso?: string; status?: string }>;
}) {
  const session = await requireAdmin();
  const { id } = await params;
  const { erro, sucesso, status } = await searchParams;

  const { user, branches } = await withTenant({ tenantId: session.tenantId }, async (tx) => ({
    user: await findUserById(tx, session.tenantId, id),
    branches: await findBranchesByTenant(tx, session.tenantId),
  }));

  if (!user) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-display text-foreground">{user.fullName}</h1>
        <span className="inline-flex items-center gap-1.5 text-meta text-muted-foreground">
          <span
            className={`size-2 rounded-full ${user.status === "active" ? "bg-primary" : "bg-border-strong"}`}
            aria-hidden="true"
          />
          {user.status === "active" ? "Ativo" : "Inativo"}
        </span>
      </div>

      <form action={updateEmployeeAction} className="flex w-full max-w-xl flex-col gap-4">
        <input type="hidden" name="id" value={user.id} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Nome completo</Label>
          <Input id="fullName" name="fullName" defaultValue={user.fullName} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="branchId">Filial</Label>
          <Select id="branchId" name="branchId" defaultValue={user.branchId} required>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role">Papel</Label>
          <Select id="role" name="role" defaultValue={user.role} required>
            <option value="employee">Colaborador</option>
            <option value="manager">Gestor</option>
            <option value="admin">Admin</option>
          </Select>
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
          <p role="alert" className="text-meta text-destructive">
            {ERROR_MESSAGES[erro]}
          </p>
        )}
        {sucesso && <p className="text-meta font-medium text-success">Alterações salvas.</p>}

        <Button type="submit" size="touch" className="self-start">Salvar alterações</Button>
      </form>

      {status === "desligado" && <p className="text-meta font-medium text-success">Colaborador desligado.</p>}
      {status === "reativado" && <p className="text-meta font-medium text-success">Colaborador reativado.</p>}

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <h2 className="text-label uppercase text-subtle-foreground">Ações</h2>
        <ResetPasswordButton userId={user.id} />
        {user.status === "active" ? (
          <ConfirmDialog
            triggerLabel="Desligar colaborador"
            triggerSize="touch"
            title="Desligar este colaborador?"
            description="O acesso é revogado imediatamente (sessões ativas encerradas). O histórico de confirmações de leitura é preservado."
            confirmLabel="Desligar"
            action={toggleEmployeeStatusAction}
            hiddenFields={{ id: user.id, nextStatus: "inactive" }}
          />
        ) : (
          <form action={toggleEmployeeStatusAction}>
            <input type="hidden" name="id" value={user.id} />
            <input type="hidden" name="nextStatus" value="active" />
            <SubmitButton variant="secondary" size="touch" pendingLabel="Reativando…">
              Reativar colaborador
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
