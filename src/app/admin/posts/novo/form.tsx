"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PostPeoplePicker, type PickablePerson } from "@/components/admin/post-people-picker";
import { createPostDraftAction } from "./actions";

export function NewPostForm({
  branches,
  people,
}: {
  branches: { id: string; name: string }[];
  people: PickablePerson[];
}) {
  return (
    <form action={createPostDraftAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="type">Tipo</Label>
        <select
          id="type"
          name="type"
          required
          defaultValue="recognition"
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
        >
          <option value="recognition">Reconhecimento</option>
          <option value="tenure">Tempo de casa</option>
          <option value="promotion">Promoção</option>
          <option value="general">Geral</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="body">Texto (opcional)</Label>
        <textarea
          id="body"
          name="body"
          rows={4}
          className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm dark:bg-input/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eventDate">Data do evento</Label>
        <Input id="eventDate" name="eventDate" type="date" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="branchId">Filial (opcional)</Label>
        <select
          id="branchId"
          name="branchId"
          defaultValue=""
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
        >
          <option value="">Geral (toda a empresa)</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      <PostPeoplePicker people={people} />

      <Button type="submit" className="self-start">
        Salvar rascunho
      </Button>
    </form>
  );
}
