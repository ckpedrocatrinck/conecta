import { notFound } from "next/navigation";
import { requireAdmin } from "../../../../../lib/auth/session";
import { withTenant } from "../../../../../lib/db/with-tenant";
import { findAnnouncementWithLatestVersion } from "../../../../../lib/repositories/announcement.repository";
import { findAnnouncementVersionHistory } from "../../../../../lib/repositories/announcement-version.repository";
import { findAnnouncementAudienceBranchIds } from "../../../../../lib/repositories/announcement-audience.repository";
import { findBranchesByTenant } from "../../../../../lib/repositories/branch.repository";
import { formatAnnouncementCode } from "../../../../../lib/announcements/publish";
import { formatDateTimeSaoPaulo } from "../../../../../lib/dates/format-datetime";
import { EditAnnouncementForm } from "./form";

const STATUS_LABEL_FALLBACK: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendado",
  published: "Publicado",
  archived: "Arquivado",
};

const ERROR_MESSAGES: Record<string, string> = {
  obrigatorio: "Preencha título, corpo e categoria.",
  "data-invalida": "Informe uma data/hora válida para o agendamento.",
  "ja-publicado": "Este comunicado já havia sido publicado por outra ação.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  publicado: "Comunicado publicado.",
  agendado: "Publicação agendada.",
  cancelado: "Agendamento cancelado.",
  arquivado: "Comunicado arquivado.",
};

export default async function EditarComunicadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; salvo?: string; ok?: string }>;
}) {
  const session = await requireAdmin();
  const { id } = await params;
  const { erro, salvo, ok } = await searchParams;

  const data = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const announcement = await findAnnouncementWithLatestVersion(tx, session.tenantId, id);
    if (!announcement) return null;
    const [history, audienceBranchIds, branches] = await Promise.all([
      findAnnouncementVersionHistory(tx, id),
      findAnnouncementAudienceBranchIds(tx, id),
      findBranchesByTenant(tx, session.tenantId),
    ]);
    return { announcement, history, audienceBranchIds: audienceBranchIds.map((a) => a.branchId), branches };
  });

  if (!data) notFound();
  const { announcement, history, audienceBranchIds, branches } = data;
  const latest = announcement.versions[0];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-display text-foreground">
        {announcement.seqNumber != null && announcement.year != null
          ? formatAnnouncementCode(announcement.seqNumber, announcement.year)
          : STATUS_LABEL_FALLBACK[announcement.status]}
      </h1>

      {erro && ERROR_MESSAGES[erro] && (
        <p role="alert" className="text-meta text-destructive">
          {ERROR_MESSAGES[erro]}
        </p>
      )}
      {salvo === "ok" && <p className="text-meta font-medium text-success">Alterações salvas.</p>}
      {ok && SUCCESS_MESSAGES[ok] && <p className="text-meta font-medium text-success">{SUCCESS_MESSAGES[ok]}</p>}

      <EditAnnouncementForm announcement={announcement} latest={latest} audienceBranchIds={audienceBranchIds} branches={branches} />

      <div className="flex flex-col gap-2">
        <h2 className="text-label uppercase text-subtle-foreground">Histórico de versões</h2>
        {history.map((v) => (
          <div key={v.id} className="rounded-[var(--radius-card)] border border-border bg-card p-4 text-body shadow-[var(--shadow-card)]">
            <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
              Versão {v.versionNumber} — {v.title}
              {v.isMaterialChange && (
                <span className="rounded-full bg-action-subtle px-2 py-0.5 text-label text-action-deep">
                  mudança material
                </span>
              )}
            </p>
            <p className="text-meta text-muted-foreground">{formatDateTimeSaoPaulo(v.createdAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
