"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createJobOpeningAction } from "./actions";

export function NewJobOpeningForm({ branches }: { branches: { id: string; name: string }[] }) {
  return (
    <form action={createJobOpeningAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Cargo</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Descrição</Label>
        <textarea
          id="description"
          name="description"
          rows={4}
          required
          className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm dark:bg-input/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="branchId">Filial (opcional)</Label>
        <select
          id="branchId"
          name="branchId"
          defaultValue=""
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
        >
          <option value="">Geral (todas as filiais)</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shift">Turno (opcional)</Label>
        <Input id="shift" name="shift" placeholder="Ex.: Manhã, Tarde, Integral" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="requirements">Requisitos (opcional)</Label>
        <textarea
          id="requirements"
          name="requirements"
          rows={3}
          className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm dark:bg-input/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="deadline">Prazo para candidatura</Label>
        <Input id="deadline" name="deadline" type="datetime-local" required />
      </div>

      <Button type="submit" className="self-start">
        Publicar vaga
      </Button>
    </form>
  );
}
