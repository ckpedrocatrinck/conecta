"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toDatetimeLocalSaoPaulo } from "@/lib/dates/format-datetime";
import { updateJobOpeningAction } from "./actions";

const TEXTAREA_CLASS =
  "w-full rounded-lg border-[1.5px] border-input bg-card px-3.5 py-2 text-body outline-none transition-colors placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-subtle";

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
    <form action={updateJobOpeningAction} className="flex w-full max-w-xl flex-col gap-4">
      <input type="hidden" name="id" value={job.id} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Cargo</Label>
        <Input id="title" name="title" required defaultValue={job.title} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Descrição</Label>
        <textarea id="description" name="description" rows={4} required defaultValue={job.description} className={TEXTAREA_CLASS} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="branchId">Filial (opcional)</Label>
        <Select id="branchId" name="branchId" defaultValue={job.branchId ?? ""}>
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
        <Input id="shift" name="shift" defaultValue={job.shift ?? ""} placeholder="Ex.: Manhã, Tarde, Integral" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="requirements">Requisitos (opcional)</Label>
        <textarea id="requirements" name="requirements" rows={3} defaultValue={job.requirements ?? ""} className={TEXTAREA_CLASS} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="deadline">Prazo para candidatura</Label>
        <Input
          id="deadline"
          name="deadline"
          type="datetime-local"
          required
          defaultValue={toDatetimeLocalSaoPaulo(job.deadline)}
        />
      </div>

      <Button type="submit" size="touch" className="self-start">
        Salvar
      </Button>
    </form>
  );
}
