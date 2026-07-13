"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEmployeeAction, type CreateEmployeeState } from "./actions";

const INITIAL_STATE: CreateEmployeeState = { status: "idle" };

export function NewEmployeeForm({ branches }: { branches: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createEmployeeAction, INITIAL_STATE);

  if (state.status === "ok") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950">
        <p>
          Colaborador <strong>{state.fullName}</strong> cadastrado. Senha provisória (repasse ao colaborador — não fica
          salva em nenhum lugar além desta tela):
        </p>
        <p className="rounded bg-white px-3 py-2 font-mono text-base tracking-wider dark:bg-black">
          {state.provisionalPassword}
        </p>
        <Link href="/admin/colaboradores" className="text-primary underline-offset-4 hover:underline">
          Voltar para colaboradores
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
        <select id="branchId" name="branchId" required defaultValue="" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30">
          <option value="" disabled>
            Selecione
          </option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="role">Papel</Label>
        <select id="role" name="role" required defaultValue="employee" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30">
          <option value="employee">Colaborador</option>
          <option value="manager">Gestor</option>
          <option value="admin">Admin</option>
        </select>
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
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Cadastrar"}
      </Button>
    </form>
  );
}
