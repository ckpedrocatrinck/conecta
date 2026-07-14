"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateJobOpeningAction } from "./actions";

type JobOpeningDetail = {
  id: string;
  title: string;
  description: string;
  branchId: string | null;
  shift: string | null;
  requirements: string | null;
  deadline: Date;
};

export function EditJobOpeningForm({
  job,
  branches,
}: {
  job: JobOpeningDetail;
  branches: { id: string; name: string }[];
}) {
  return (
    <form action={updateJobOpeningAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={job.id} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Cargo</Label>
        <Input id="title" name="title" required defaultValue={job.title} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Descrição</Label>
        <textarea
          id="description"
          name="description"
          rows={4}
          required
          defaultValue={job.description}
          className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm dark:bg-input/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="branchId">Filial (opcional)</Label>
        <select
          id="branchId"
          name="branchId"
          defaultValue={job.branchId ?? ""}
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
        <Input id="shift" name="shift" defaultValue={job.shift ?? ""} placeholder="Ex.: Manhã, Tarde, Integral" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="requirements">Requisitos (opcional)</Label>
        <textarea
          id="requirements"
          name="requirements"
          rows={3}
          defaultValue={job.requirements ?? ""}
          className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm dark:bg-input/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="deadline">Prazo para candidatura</Label>
        <Input
          id="deadline"
          name="deadline"
          type="datetime-local"
          required
          defaultValue={job.deadline.toISOString().slice(0, 16)}
        />
      </div>

      <Button type="submit" className="self-start">
        Salvar
      </Button>
    </form>
  );
}
