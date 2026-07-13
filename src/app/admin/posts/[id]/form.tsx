"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PostPeoplePicker, type PickablePerson } from "@/components/admin/post-people-picker";
import { updatePostAction } from "./actions";

type PostDetail = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  eventDate: Date;
  branchId: string | null;
};

export function EditPostForm({
  post,
  branches,
  people,
  selectedPersonIds,
}: {
  post: PostDetail;
  branches: { id: string; name: string }[];
  people: PickablePerson[];
  selectedPersonIds: string[];
}) {
  return (
    <form action={updatePostAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={post.id} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="type">Tipo</Label>
        <select
          id="type"
          name="type"
          required
          defaultValue={post.type}
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
        <Input id="title" name="title" required defaultValue={post.title} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="body">Texto (opcional)</Label>
        <textarea
          id="body"
          name="body"
          rows={4}
          defaultValue={post.body ?? ""}
          className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm dark:bg-input/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eventDate">Data do evento</Label>
        <Input id="eventDate" name="eventDate" type="date" required defaultValue={post.eventDate.toISOString().slice(0, 10)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="branchId">Filial (opcional)</Label>
        <select
          id="branchId"
          name="branchId"
          defaultValue={post.branchId ?? ""}
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

      <PostPeoplePicker people={people} defaultSelectedIds={selectedPersonIds} />

      <Button type="submit" className="self-start">
        Salvar
      </Button>
    </form>
  );
}
