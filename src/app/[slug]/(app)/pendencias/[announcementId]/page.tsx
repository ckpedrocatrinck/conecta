import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/ui/submit-button";
import { filterChipVariants } from "@/components/ui/filter-chip";
import { requireAdminOrManager } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { getAnnouncementPendencyDetail } from "@/lib/announcements/pending-panel";
import { formatAnnouncementCode } from "@/lib/announcements/publish";
import { formatAnnouncementCategory } from "@/lib/announcements/category-labels";
import { findBranchesByTenant } from "@/lib/repositories/branch.repository";
import { formatDateTimeSaoPaulo } from "@/lib/dates/format-datetime";
import { remindPendingAction } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  published: "Publicado",
  archived: "Arquivado",
};

export default async function PendenciaDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ announcementId: string }>;
  searchParams: Promise<{ filial?: string; cobranca?: string }>;
}) {
  const session = await requireAdminOrManager();
  const isManager = session.role === "manager";
  const { announcementId } = await params;
  const { filial, cobranca } = await searchParams;

  const { detail, branches } = await withTenant({ tenantId: session.tenantId }, async (tx) => ({
    detail: await getAnnouncementPendencyDetail(tx, session.tenantId, announcementId, {
      branchId: isManager ? session.branchId : undefined,
    }),
    branches: isManager ? [] : await findBranchesByTenant(tx, session.tenantId),
  }));

  if (!detail) notFound();

  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
  const pending = filial ? detail.pending.filter((u) => u.branchId === filial) : detail.pending;
  const confirmed = filial ? detail.confirmed.filter((u) => u.branchId === filial) : detail.confirmed;
  const total = detail.pending.length + detail.confirmed.length;
  const percent = total === 0 ? 0 : Math.round((detail.confirmed.length / total) * 100);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-label uppercase text-subtle-foreground">
          {detail.announcement.seqNumber != null && detail.announcement.year != null
            ? formatAnnouncementCode(detail.announcement.seqNumber, detail.announcement.year)
            : "sem número"}
          {" · "}
          {formatAnnouncementCategory(detail.announcement.category)}
          {" · "}
          {STATUS_LABEL[detail.announcement.status] ?? detail.announcement.status}
        </span>
        <h1 className="text-display text-foreground">
          {detail.confirmed.length}/{total} confirmados ({percent}%)
        </h1>
        {detail.announcement.status === "archived" && detail.pending.length > 0 && (
          <p className="text-meta font-semibold text-destructive">
            Arquivado com {detail.pending.length} pendência{detail.pending.length > 1 ? "s" : ""} não resolvida
            {detail.pending.length > 1 ? "s" : ""}.
          </p>
        )}
      </div>

      {cobranca != null && (
        <p className="rounded-[var(--radius-card)] border border-action-border bg-action-subtle px-4 py-3 text-meta font-medium text-action-deep">
          {Number(cobranca) > 0
            ? `${cobranca} colaborador${Number(cobranca) > 1 ? "es" : ""} notificado${Number(cobranca) > 1 ? "s" : ""}.`
            : "Ninguém pendente para notificar."}
        </p>
      )}

      {detail.pending.length > 0 && (
        <form action={remindPendingAction}>
          <input type="hidden" name="announcementId" value={announcementId} />
          <SubmitButton variant="action" size="xl" className="w-full" pendingLabel="Cobrando…">
            Cobrar pendentes
          </SubmitButton>
        </form>
      )}

      <a
        href={`/${session.tenantSlug}/pendencias/${announcementId}/export${filial ? `?filial=${filial}` : ""}`}
        className="text-meta font-semibold text-primary underline-offset-4 hover:underline"
      >
        Exportar CSV de confirmações
      </a>

      {!isManager && branches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/${session.tenantSlug}/pendencias/${announcementId}`} className={filterChipVariants({ active: !filial })}>
            Todas as filiais
          </Link>
          {branches.map((b) => (
            <Link
              key={b.id}
              href={{ pathname: `/${session.tenantSlug}/pendencias/${announcementId}`, query: { filial: b.id } }}
              className={filterChipVariants({ active: filial === b.id })}
            >
              {b.name}
            </Link>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-card-title font-bold text-foreground">Pendentes ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-meta text-muted-foreground">Ninguém pendente{filial ? " nesta filial" : ""}.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map((u) => (
              <Link
                key={u.id}
                href={`/${session.tenantSlug}/pendencias/colaborador/${u.id}`}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-card)] border border-border bg-card p-3.5 text-body shadow-[var(--shadow-card)] transition-colors hover:bg-muted"
              >
                <span className="font-semibold text-foreground">{u.fullName}</span>
                <span className="text-meta text-muted-foreground">{branchNameById.get(u.branchId) ?? ""}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-card-title font-bold text-foreground">Confirmados ({confirmed.length})</h2>
        {confirmed.length === 0 ? (
          <p className="text-meta text-muted-foreground">Ninguém confirmou ainda{filial ? " nesta filial" : ""}.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {confirmed.map((u) => (
              <Link
                key={u.id}
                href={`/${session.tenantSlug}/pendencias/colaborador/${u.id}`}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-card)] border border-border bg-card p-3.5 text-body shadow-[var(--shadow-card)] transition-colors hover:bg-muted"
              >
                <span className="font-semibold text-foreground">{u.fullName}</span>
                <span className="text-meta font-medium text-success">{formatDateTimeSaoPaulo(u.ackedAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
