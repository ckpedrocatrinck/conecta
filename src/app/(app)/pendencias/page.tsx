import Link from "next/link";
import { ClipboardList, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminOrManager } from "../../../lib/auth/session";
import { withTenant } from "../../../lib/db/with-tenant";
import { listAnnouncementPendencySummaries } from "../../../lib/announcements/pending-panel";
import { formatAnnouncementCode } from "../../../lib/announcements/publish";
import { findBranchesByTenant } from "../../../lib/repositories/branch.repository";

export default async function PendenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ filial?: string }>;
}) {
  const session = await requireAdminOrManager();
  const isManager = session.role === "manager";
  const { filial } = await searchParams;
  const scopeBranchId = isManager ? session.branchId : filial || undefined;

  const { summaries, branches } = await withTenant({ tenantId: session.tenantId }, async (tx) => ({
    summaries: await listAnnouncementPendencySummaries(tx, session.tenantId, { branchId: scopeBranchId }),
    branches: isManager ? [] : await findBranchesByTenant(tx, session.tenantId),
  }));

  const dp11Count = summaries.filter((s) => s.isArchivedWithPendency).length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Painel de pendências</h1>

      {dp11Count > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-destructive/10 px-4 py-3 text-destructive">
          <TriangleAlert className="size-5 shrink-0" aria-hidden="true" />
          <p className="flex-1 text-sm font-medium">
            {dp11Count} comunicado{dp11Count > 1 ? "s" : ""} arquivado{dp11Count > 1 ? "s" : ""} com pendência de ciência
            não resolvida.
          </p>
        </div>
      )}

      {!isManager && branches.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-sm">
          <Link
            href="/pendencias"
            className={!filial ? "rounded-lg bg-primary px-2.5 py-1 text-primary-foreground" : "rounded-lg px-2.5 py-1 text-muted-foreground hover:bg-muted"}
          >
            Todas as filiais
          </Link>
          {branches.map((b) => (
            <Link
              key={b.id}
              href={{ pathname: "/pendencias", query: { filial: b.id } }}
              className={filial === b.id ? "rounded-lg bg-primary px-2.5 py-1 text-primary-foreground" : "rounded-lg px-2.5 py-1 text-muted-foreground hover:bg-muted"}
            >
              {b.name}
            </Link>
          ))}
        </div>
      )}

      {summaries.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum comunicado com pendência"
          description="Comunicados que exigem ciência aparecem aqui com o percentual de confirmação."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {summaries.map((s) => (
            <Link
              key={s.announcement.id}
              href={`/pendencias/${s.announcement.id}`}
              className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-card p-3 shadow-[var(--shadow-card)] hover:bg-muted"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-foreground">
                  {s.announcement.seqNumber != null && s.announcement.year != null
                    ? formatAnnouncementCode(s.announcement.seqNumber, s.announcement.year)
                    : "sem número"}
                  {" · "}
                  {s.announcement.category}
                </span>
                {s.isArchivedWithPendency && (
                  <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                    Arquivado com pendência
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  {s.confirmedCount}/{s.targetTotal} confirmados
                  {s.pendingCount > 0 && ` · ${s.pendingCount} pendente${s.pendingCount > 1 ? "s" : ""}`}
                </span>
                <span className={s.percentConfirmed === 100 ? "font-semibold text-success" : "font-semibold text-action"}>
                  {s.percentConfirmed}%
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
