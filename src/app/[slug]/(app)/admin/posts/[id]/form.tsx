"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { PostPeoplePicker, type PickablePerson } from "@/components/admin/post-people-picker";
import { PostCardPreview, type PreviewImage } from "@/components/admin/post-card-preview";
import type { TenantBranding } from "@/lib/repositories/tenant.repository";
import { updatePostAction } from "./actions";

type PostDetail = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  eventDate: Date;
  branchId: string | null;
  status: string;
};

export function EditPostForm({
  post,
  branches,
  people,
  selectedPersonIds,
  branding,
  previewImages = [],
}: {
  post: PostDetail;
  branches: { id: string; name: string }[];
  people: PickablePerson[];
  selectedPersonIds: string[];
  branding: TenantBranding;
  previewImages?: PreviewImage[];
}) {
  const [type, setType] = useState(post.type);
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body ?? "");
  const [selectedPeople, setSelectedPeople] = useState<PickablePerson[]>(
    people.filter((p) => selectedPersonIds.includes(p.id)),
  );

  return (
    <form action={updatePostAction} className="flex w-full max-w-xl flex-col gap-4">
      <input type="hidden" name="id" value={post.id} />

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
        <Input id="eventDate" name="eventDate" type="date" required defaultValue={post.eventDate.toISOString().slice(0, 10)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="branchId">Filial (opcional)</Label>
        <Select id="branchId" name="branchId" defaultValue={post.branchId ?? ""}>
          <option value="">Geral (toda a empresa)</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </Select>
      </div>

      <PostPeoplePicker people={people} defaultSelectedIds={selectedPersonIds} onSelectionChange={setSelectedPeople} />

      <PostCardPreview
        type={type}
        title={title}
        body={body}
        selectedPeople={selectedPeople}
        branding={branding}
        images={previewImages}
      />

      {/* Um form, dois submits: o botao clicado envia name=intent, e a
          updatePostAction salva (save) ou salva+publica (publish) usando o
          TITULO do formulario — por isso "digitar titulo e Publicar" funciona
          sem salvar antes (INC-016). */}
      <div className="flex flex-wrap gap-2">
        <SubmitButton type="submit" name="intent" value="save" variant="outline" size="touch" pendingLabel="Salvando…">
          Salvar rascunho
        </SubmitButton>
        {post.status === "draft" && (
          <SubmitButton type="submit" name="intent" value="publish" size="touch" pendingLabel="Publicando…">
            Publicar
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
