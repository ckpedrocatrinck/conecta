"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { createJobOpeningAction } from "./actions";

const TEXTAREA_CLASS =
  "w-full rounded-lg border-[1.5px] border-input bg-card px-3.5 py-2 text-body outline-none transition-colors placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-subtle";

export function NewJobOpeningForm({ branches }: { branches: { id: string; name: string }[] }) {
  return (
    <form action={createJobOpeningAction} className="flex w-full max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Cargo</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Descrição</Label>
        <textarea id="description" name="description" rows={4} required className={TEXTAREA_CLASS} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="branchId">Filial (opcional)</Label>
        <Select id="branchId" name="branchId" defaultValue="">
          <option value="">Geral (todas as filiais)</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shift">Turno (opcional)</Label>
        <Input id="shift" name="shift" placeholder="Ex.: Manhã, Tarde, Integral" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="requirements">Requisitos (opcional)</Label>
        <textarea id="requirements" name="requirements" rows={3} className={TEXTAREA_CLASS} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="deadline">Prazo para candidatura</Label>
        <Input id="deadline" name="deadline" type="datetime-local" required />
      </div>

      <Button type="submit" size="touch" className="self-start">
        Publicar vaga
      </Button>
    </form>
  );
}
