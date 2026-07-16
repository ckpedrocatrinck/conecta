"use client";

import type { Announcement, AnnouncementVersion } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { RichTextContent } from "@/components/announcements/rich-text-content";
import { RichTextEditor } from "@/components/announcements/rich-text-editor";
import {
  archiveAnnouncementAction,
  publishAnnouncementNowAction,
  saveAnnouncementContentAction,
  scheduleAnnouncementAction,
  unscheduleAnnouncementAction,
} from "./actions";

export function EditAnnouncementForm({
  announcement,
  latest,
  audienceBranchIds,
  branches,
}: {
  announcement: Announcement;
  latest: AnnouncementVersion | undefined;
  audienceBranchIds: string[];
  branches: { id: string; name: string }[];
}) {
  if (announcement.status === "archived") {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <p className="text-sm text-muted-foreground">Comunicado arquivado — sem edição possível.</p>
        <h2 className="text-lg font-bold text-foreground">{latest?.title}</h2>
        {latest && <RichTextContent html={latest.body} />}
      </div>
    );
  }

  const criticalityLocked = announcement.seqNumber !== null;
  const showMaterialChangeCheckbox = announcement.status === "published" && announcement.criticality === "requires_ack";

  return (
    <div className="flex flex-col gap-6">
      <form action={saveAnnouncementContentAction} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={announcement.id} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Título</Label>
          <Input id="title" name="title" defaultValue={latest?.title} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="body">Corpo</Label>
          <RichTextEditor name="body" defaultValue={latest?.body} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Categoria</Label>
          <Input id="category" name="category" defaultValue={announcement.category} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="criticality">Criticidade</Label>
          <select
            id="criticality"
            name="criticality"
            defaultValue={announcement.criticality}
            disabled={criticalityLocked}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm disabled:opacity-50 dark:bg-input/30"
          >
            <option value="info">Informativo</option>
            <option value="requires_ack">Exige confirmação de leitura</option>
          </select>
          {criticalityLocked && (
            <p className="text-xs text-muted-foreground">Já publicado — criticidade não pode mais ser alterada.</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Público-alvo</Label>
          <p className="text-sm text-muted-foreground">Deixe todas desmarcadas para publicar para toda a empresa.</p>
          <div className="flex flex-col gap-2">
            {branches.map((branch) => (
              <label key={branch.id} className="flex items-center gap-2.5 text-sm text-foreground">
                <Checkbox name="branchIds" value={branch.id} defaultChecked={audienceBranchIds.includes(branch.id)} />
                {branch.name}
              </label>
            ))}
          </div>
        </div>

        {showMaterialChangeCheckbox && (
          <label className="flex items-center gap-2.5 text-sm text-foreground">
            <Checkbox name="isMaterialChange" />
            Marcar como mudança material (reabre pendências de confirmação — INC-005)
          </label>
        )}

        <Button type="submit" className="self-start">
          Salvar alterações
        </Button>
      </form>

      <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
        {(announcement.status === "draft" || announcement.status === "scheduled") && (
          <form action={publishAnnouncementNowAction}>
            <input type="hidden" name="id" value={announcement.id} />
            <SubmitButton pendingLabel="Publicando…">Publicar agora</SubmitButton>
          </form>
        )}

        {announcement.status === "draft" && (
          <form action={scheduleAnnouncementAction} className="flex items-end gap-2">
            <input type="hidden" name="id" value={announcement.id} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="publishAt">Agendar para</Label>
              <Input id="publishAt" name="publishAt" type="datetime-local" required />
            </div>
            <SubmitButton variant="secondary" pendingLabel="Agendando…">
              Agendar
            </SubmitButton>
          </form>
        )}

        {announcement.status === "scheduled" && (
          <>
            <p className="text-sm text-muted-foreground">
              Agendado para {announcement.publishAt?.toISOString()}
            </p>
            <form action={unscheduleAnnouncementAction}>
              <input type="hidden" name="id" value={announcement.id} />
              <SubmitButton variant="secondary" pendingLabel="Cancelando…">
                Cancelar agendamento
              </SubmitButton>
            </form>
          </>
        )}

        <ConfirmDialog
          triggerLabel="Arquivar"
          title="Arquivar este comunicado?"
          description="O comunicado deixa de aparecer para os colaboradores. Pendências de confirmação de leitura ainda não resolvidas continuam sinalizadas na auditoria."
          confirmLabel="Arquivar"
          action={archiveAnnouncementAction}
          hiddenFields={{ id: announcement.id }}
        />
      </div>
    </div>
  );
}
