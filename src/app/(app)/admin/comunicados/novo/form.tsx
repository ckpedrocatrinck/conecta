"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/announcements/rich-text-editor";
import { createAnnouncementDraftAction } from "./actions";

export function NewAnnouncementForm({ branches }: { branches: { id: string; name: string }[] }) {
  return (
    <form action={createAnnouncementDraftAction} className="flex w-full max-w-2xl flex-col gap-4">
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
        <Select id="criticality" name="criticality" required defaultValue="info">
          <option value="info">Informativo</option>
          <option value="requires_ack">Exige confirmação de leitura</option>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Público-alvo</Label>
        <p className="text-meta text-muted-foreground">Deixe todas desmarcadas para publicar para toda a empresa.</p>
        <div className="flex flex-col gap-2">
          {branches.map((branch) => (
            <label key={branch.id} className="flex items-center gap-2.5 text-body text-foreground">
              <Checkbox name="branchIds" value={branch.id} />
              {branch.name}
            </label>
          ))}
        </div>
      </div>

      <Button type="submit" size="touch" className="self-start">
        Salvar rascunho
      </Button>
    </form>
  );
}
