import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { filterChipVariants } from "@/components/ui/filter-chip";
import { StatCard } from "@/components/admin/stat-card";
import { requireAdmin } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { findAnnouncementsForAdminList, searchAnnouncementIds } from "@/lib/repositories/announcement.repository";
import { listAnnouncementPendencySummaries } from "@/lib/announcements/pending-panel";
import { formatAnnouncementCode } from "@/lib/announcements/publish";
import { formatAnnouncementCategory } from "@/lib/announcements/category-labels";
import { formatCalendarDate } from "@/lib/dates/format-date";
import type { AnnouncementStatus } from "@prisma/client";

const STATUS_LABEL: Record<AnnouncementStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendado",
  published: "Publicado",
  archived: "Arquivado",
};

/** Ponto de status (INC-013.5): publicado verde, agendado laranja (decisão do
 * Pedro 2026-07-18 seguindo o prototipo), rascunho/arquivado neutros. */
const STATUS_DOT: Record<AnnouncementStatus, string> = {
  draft: "bg-border-strong",
  scheduled: "bg-action",
  published: "bg-primary",
  archived: "bg-border-strong",
};

/** Tempo relativo curto para a linha de rodapé do card (ex.: "há 2 dias"). */
function relativePublished(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "há instantes";
  if (hours < 24) return `há ${hours} hora${hours > 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days > 1 ? "s" : ""}`;
}

function footerLine(status: AnnouncementStatus, publishAt: Date | null): string {
  if (status === "published" && publishAt) return `Publicado ${relativePublished(publishAt)}`;
  if (status === "scheduled" && publishAt) return `Publicação agendada para ${formatCalendarDate(publishAt)}`;
  if (status === "archived") return "Arquivado";
  return "Em edição";
}

const STATUS_FILTERS: { value: AnnouncementStatus | ""; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "draft", label: "Rascunho" },
  { value: "scheduled", label: "Agendado" },
  { value: "published", label: "Publicado" },
  { value: "archived", label: "Arquivado" },
];

export default async function ComunicadosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await requireAdmin();
  const { q, status } = await searchParams;
  const statusFilter = status && status in STATUS_LABEL ? (status as AnnouncementStatus) : undefined;

  const { all, pendingAcksTotal, matchingIds, summaryById } = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const all = await findAnnouncementsForAdminList(tx, session.tenantId);
    const summaries = await listAnnouncementPendencySummaries(tx, session.tenantId);
    const matchingIds = q ? new Set(await searchAnnouncementIds(tx, session.tenantId, q)) : null;
    return {
      all,
      pendingAcksTotal: summaries.reduce((sum, s) => sum + s.pendingCount, 0),
      matchingIds,
      summaryById: new Map(summaries.map((s) => [s.announcement.id, s])),
    };
  });

  const countByStatus = (s: AnnouncementStatus) => all.filter((a) => a.status === s).length;
  const announcements = all.filter(
    (a) => (!statusFilter || a.status === statusFilter) && (!matchingIds || matchingIds.has(a.id)),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-display text-foreground">Comunicados</h1>
          <p className="text-meta text-muted-foreground">Publique, acompanhe confirmações e exporte comprovações.</p>
        </div>
        <Link href={`/${session.tenantSlug}/admin/comunicados/novo`} className={buttonVariants({ variant: "default", size: "touch" })}>
          <Plus aria-hidden="true" />
          Novo comunicado
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Publicados" value={countByStatus("published")} />
        <StatCard label="Ciências pendentes" value={pendingAcksTotal} accent />
        <StatCard label="Agendados" value={countByStatus("scheduled")} />
        <StatCard label="Rascunhos" value={countByStatus("draft")} />
      </div>

      <form className="flex flex-col gap-3 sm:flex-row sm:items-center" action={`/${session.tenantSlug}/admin/comunicados`}>
        <Input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por título ou corpo..."
          className="sm:flex-1"
        />
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <Link
              key={f.value || "todos"}
              href={{ pathname: `/${session.tenantSlug}/admin/comunicados`, query: { ...(q ? { q } : {}), ...(f.value ? { status: f.value } : {}) } }}
              className={filterChipVariants({ active: (status ?? "") === f.value })}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </form>

      {announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhum comunicado encontrado"
          description="Crie um novo comunicado ou ajuste os filtros de busca."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {announcements.map((a) => {
            const latest = a.versions[0];
            const summary = summaryById.get(a.id);
            return (
              <Link
                key={a.id}
                href={`/${session.tenantSlug}/admin/comunicados/${a.id}`}
                className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-muted"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-meta text-muted-foreground">
                    {a.seqNumber != null && a.year != null ? formatAnnouncementCode(a.seqNumber, a.year) : "sem número"}
                    {" · "}
                    {formatAnnouncementCategory(a.category)}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-meta font-semibold text-muted-foreground">
                    <span className={`size-2 rounded-full ${STATUS_DOT[a.status]}`} aria-hidden="true" />
                    {STATUS_LABEL[a.status]}
                  </span>
                </div>

                <span className="text-card-title font-bold text-foreground">{latest?.title ?? "(sem título)"}</span>

                {a.status === "published" && summary && (
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${summary.pendingCount === 0 ? "bg-success" : "bg-action"}`}
                        style={{ width: `${summary.percentConfirmed}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-meta text-muted-foreground">
                      {summary.confirmedCount}/{summary.targetTotal} confirmaram
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  <span className="text-meta text-subtle-foreground">{footerLine(a.status, a.publishAt)}</span>
                  <span className="text-meta font-semibold text-primary">Abrir ›</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
