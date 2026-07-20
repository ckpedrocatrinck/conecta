"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { createEmployeeAction, type CreateEmployeeState } from "./actions";

const INITIAL_STATE: CreateEmployeeState = { status: "idle" };

export function NewEmployeeForm({ branches }: { branches: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createEmployeeAction, INITIAL_STATE);

  if (state.status === "ok") {
    return (
      <div className="flex max-w-xl flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-primary-subtle p-4 text-body text-foreground">
        <p>
          Colaborador <strong>{state.fullName}</strong> cadastrado. Senha provisória (repasse ao colaborador — não fica
          salva em nenhum lugar além desta tela):
        </p>
        <p className="rounded-lg border border-border bg-card px-3 py-2 font-mono text-base tracking-wider text-foreground">
          {state.provisionalPassword}
        </p>
        <Link href="/admin/colaboradores" className="text-meta font-semibold text-primary underline-offset-4 hover:underline">
          Voltar para colaboradores
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input id="fullName" name="fullName" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="registrationCode">Matrícula</Label>
        <Input id="registrationCode" name="registrationCode" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cpf">CPF</Label>
        <Input id="cpf" name="cpf" inputMode="numeric" placeholder="Somente números" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="branchId">Filial</Label>
        <Select id="branchId" name="branchId" required defaultValue="">
          <option value="" disabled>
            Selecione
          </option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="role">Papel</Label>
        <Select id="role" name="role" required defaultValue="employee">
          <option value="employee">Colaborador</option>
          <option value="manager">Gestor</option>
          <option value="admin">Admin</option>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="birthDate">Data de nascimento</Label>
        <Input id="birthDate" name="birthDate" type="date" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hiredAt">Data de contratação</Label>
        <Input id="hiredAt" name="hiredAt" type="date" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Telefone (opcional)</Label>
        <Input id="phone" name="phone" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail (opcional)</Label>
        <Input id="email" name="email" type="email" />
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-meta text-destructive">
          {state.message}
        </p>
      )}

      <Button type="submit" size="touch" className="self-start" disabled={pending}>
        {pending ? "Salvando..." : "Cadastrar"}
      </Button>
    </form>
  );
}
