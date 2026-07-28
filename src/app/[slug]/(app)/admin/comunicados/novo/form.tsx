"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmSubmitDialog } from "@/components/ui/confirm-submit-dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/announcements/rich-text-editor";
import {
  createAndPublishAnnouncementAction,
  createAndScheduleAnnouncementAction,
  createAnnouncementDraftAction,
} from "./actions";

// O `id` liga o formulario aos botoes de confirmar dos dialogos (ver
// ConfirmSubmitDialog).
const FORM_ID = "novo-comunicado";

/** "14/08/2026 as 08:00" a partir do valor cru do datetime-local. Nao passa
 * por `new Date()`: o valor ja' e' horario de Sao Paulo e reinterpretar no
 * fuso do browser deslocaria o que o admin esta' confirmando. */
function describeScheduledAt(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return "";
  const [, year, month, day, hour, minute] = match;
  return `${day}/${month}/${year} às ${hour}:${minute}`;
}

export function NewAnnouncementForm({ branches }: { branches: { id: string; name: string }[] }) {
  // Estado so' do que a trava de confirmacao precisa enunciar (titulo,
  // criticidade, publico-alvo, data resolvida) — corpo e categoria seguem
  // nao-controlados; quem valida de verdade e' a Server Action.
  const [title, setTitle] = useState("");
  const [criticality, setCriticality] = useState<"info" | "requires_ack">("info");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [publishAt, setPublishAt] = useState("");
  // Os dialogos de confirmacao sao portalizados PARA DENTRO deste elemento,
  // que vive dentro do <form> — assim o botao "confirmar" e' um submit
  // descendente do formulario (ver ConfirmSubmitDialog).
  const dialogContainerRef = useRef<HTMLDivElement>(null);

  const trimmedTitle = title.trim();
  const audienceLabel =
    branchIds.length === 0
      ? "toda a empresa"
      : branches
          .filter((branch) => branchIds.includes(branch.id))
          .map((branch) => branch.name)
          .join(", ");

  const toggleBranch = (branchId: string, checked: boolean) =>
    setBranchIds((current) => (checked ? [...current, branchId] : current.filter((id) => id !== branchId)));

  const ackConsequence =
    criticality === "requires_ack"
      ? `Abre pendência de confirmação de leitura para todo o público-alvo (${audienceLabel}).`
      : `Comunicado informativo: não abre pendência de confirmação de leitura. Público-alvo: ${audienceLabel}.`;

  return (
    <form id={FORM_ID} action={createAnnouncementDraftAction} className="flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
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
        <Select
          id="criticality"
          name="criticality"
          required
          value={criticality}
          onChange={(e) => setCriticality(e.target.value as "info" | "requires_ack")}
        >
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
              <Checkbox
                name="branchIds"
                value={branch.id}
                checked={branchIds.includes(branch.id)}
                onCheckedChange={(checked) => toggleBranch(branch.id, checked)}
              />
              {branch.name}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="publishAt">Agendar para</Label>
        <Input
          id="publishAt"
          name="publishAt"
          type="datetime-local"
          value={publishAt}
          onChange={(e) => setPublishAt(e.target.value)}
          className="max-w-xs"
        />
        <p className="text-meta text-muted-foreground">
          Só é usado pela ação “Agendar”. Horário de Brasília, sempre no futuro.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        {/* "Salvar rascunho" e' a acao padrao do form e NAO tem confirmacao:
            rascunho nao gera numero nem pendencia (INC-018 item 6). */}
        <Button type="submit" size="touch">
          Salvar rascunho
        </Button>

        <ConfirmSubmitDialog
          triggerLabel="Publicar agora"
          triggerVariant="action"
          triggerDisabled={trimmedTitle.length === 0}
          title="Publicar este comunicado agora?"
          confirmLabel="Publicar agora"
          pendingLabel="Publicando…"
          formId={FORM_ID}
          formAction={createAndPublishAnnouncementAction}
          container={dialogContainerRef}
        >
          <p>
            <strong className="font-semibold text-foreground">{trimmedTitle}</strong> recebe um número{" "}
            <strong className="font-semibold text-foreground">CI NN/AAAA</strong> permanente, da sequência da empresa no
            ano — não é possível reciclar nem renumerar depois.
          </p>
          <p>{ackConsequence}</p>
          <p>O comunicado fica visível para o público-alvo imediatamente.</p>
        </ConfirmSubmitDialog>

        <ConfirmSubmitDialog
          triggerLabel="Agendar"
          triggerVariant="secondary"
          triggerDisabled={trimmedTitle.length === 0 || publishAt.length === 0}
          title="Agendar a publicação?"
          confirmLabel="Agendar"
          pendingLabel="Agendando…"
          confirmVariant="default"
          formId={FORM_ID}
          formAction={createAndScheduleAnnouncementAction}
          container={dialogContainerRef}
        >
          <p>
            <strong className="font-semibold text-foreground">{trimmedTitle}</strong> será publicado em{" "}
            <strong className="font-semibold text-foreground">{describeScheduledAt(publishAt)}</strong> (horário de
            Brasília).
          </p>
          <p>
            O número <strong className="font-semibold text-foreground">CI NN/AAAA</strong> permanente só é atribuído no
            momento da publicação.
          </p>
          <p>{ackConsequence}</p>
        </ConfirmSubmitDialog>
      </div>

      {trimmedTitle.length === 0 && (
        <p className="text-meta text-muted-foreground">Informe o título para liberar “Publicar agora” e “Agendar”.</p>
      )}
      {trimmedTitle.length > 0 && publishAt.length === 0 && (
        <p className="text-meta text-muted-foreground">Informe a data e hora para liberar “Agendar”.</p>
      )}

      {/* `absolute` tira do fluxo: o form e' flex com gap, e um filho vazio
          somaria um espaco extra no rodape. O popup e' `fixed` la dentro. */}
      <div ref={dialogContainerRef} className="absolute" />
    </form>
  );
}
