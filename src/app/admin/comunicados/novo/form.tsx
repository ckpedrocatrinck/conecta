"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/announcements/rich-text-editor";
import { createAnnouncementDraftAction } from "./actions";

export function NewAnnouncementForm({ branches }: { branches: { id: string; name: string }[] }) {
  return (
    <form action={createAnnouncementDraftAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="body">Corpo</Label>
        <RichTextEditor name="body" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category">Categoria</Label>
        <Input id="category" name="category" placeholder="Ex.: RH, Segurança, Operações" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="criticality">Criticidade</Label>
        <select
          id="criticality"
          name="criticality"
          required
          defaultValue="info"
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
        >
          <option value="info">Informativo</option>
          <option value="requires_ack">Exige confirmação de leitura</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Público-alvo</Label>
        <p className="text-sm text-muted-foreground">Deixe todas desmarcadas para publicar para toda a empresa.</p>
        <div className="flex flex-col gap-2">
          {branches.map((branch) => (
            <label key={branch.id} className="flex items-center gap-2.5 text-sm text-foreground">
              <Checkbox name="branchIds" value={branch.id} />
              {branch.name}
            </label>
          ))}
        </div>
      </div>

      <Button type="submit" className="self-start">
        Salvar rascunho
      </Button>
    </form>
  );
}
