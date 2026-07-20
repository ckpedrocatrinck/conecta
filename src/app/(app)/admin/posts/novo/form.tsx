"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
    <form action={createPostDraftAction} className="flex w-full max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="type">Tipo</Label>
        <Select id="type" name="type" required value={type} onChange={(e) => setType(e.target.value)}>
          <option value="recognition">Reconhecimento</option>
          <option value="tenure">Tempo de casa</option>
          <option value="promotion">Promoção</option>
          <option value="general">Geral</option>
        </Select>
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
          className="w-full rounded-lg border-[1.5px] border-input bg-card px-3.5 py-2 text-body outline-none transition-colors placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-subtle"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eventDate">Data do evento</Label>
        <Input id="eventDate" name="eventDate" type="date" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="branchId">Filial (opcional)</Label>
        <Select id="branchId" name="branchId" defaultValue="">
          <option value="">Geral (toda a empresa)</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </Select>
      </div>

      <PostPeoplePicker people={people} onSelectionChange={setSelectedPeople} />

      <PostCardPreview type={type} title={title} body={body} selectedPeople={selectedPeople} branding={branding} />

      <Button type="submit" size="touch" className="self-start">
        Salvar rascunho
      </Button>
    </form>
  );
}
