"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PostPeoplePicker, type PickablePerson } from "@/components/admin/post-people-picker";
import { PostCardPreview } from "@/components/admin/post-card-preview";
import type { TenantBranding } from "@/lib/repositories/tenant.repository";
import { createPostDraftAction } from "./actions";

export function NewPostForm({
  branches,
  people,
  branding,
}: {
  branches: { id: string; name: string }[];
  people: PickablePerson[];
  branding: TenantBranding;
}) {
  const [type, setType] = useState("recognition");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedPeople, setSelectedPeople] = useState<PickablePerson[]>([]);

  return (
    <form action={createPostDraftAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="type">Tipo</Label>
        <select
          id="type"
          name="type"
          required
          value={type}
          onChange={(e) => setType(e.target.value)}
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
        <Input id="title" name="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="body">Texto (opcional)</Label>
        <textarea
          id="body"
          name="body"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
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

      <PostPeoplePicker people={people} onSelectionChange={setSelectedPeople} />

      <PostCardPreview type={type} title={title} body={body} selectedPeople={selectedPeople} branding={branding} />

      <Button type="submit" className="self-start">
        Salvar rascunho
      </Button>
    </form>
  );
}
