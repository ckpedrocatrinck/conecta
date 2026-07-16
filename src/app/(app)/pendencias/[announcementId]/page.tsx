import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdminOrManager } from "../../../../lib/auth/session";
import { withTenant } from "../../../../lib/db/with-tenant";
import { getAnnouncementPendencyDetail } from "../../../../lib/announcements/pending-panel";
import { formatAnnouncementCode } from "../../../../lib/announcements/publish";
import { findBranchesByTenant } from "../../../../lib/repositories/branch.repository";
import { formatDateTimeSaoPaulo } from "../../../../lib/dates/format-datetime";
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
        <span className="text-sm text-muted-foreground">
          {detail.announcement.seqNumber != null && detail.announcement.year != null
            ? formatAnnouncementCode(detail.announcement.seqNumber, detail.announcement.year)
            : "sem número"}
          {" · "}
          {detail.announcement.category}
          {" · "}
          {STATUS_LABEL[detail.announcement.status] ?? detail.announcement.status}
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          {detail.confirmed.length}/{total} confirmados ({percent}%)
        </h1>
        {detail.announcement.status === "archived" && detail.pending.length > 0 && (
          <p className="text-sm font-semibold text-destructive">
            Arquivado com {detail.pending.length} pendência{detail.pending.length > 1 ? "s" : ""} não resolvida
            {detail.pending.length > 1 ? "s" : ""}.
          </p>
        )}
      </div>

      {cobranca != null && (
        <p className="rounded-lg bg-action-subtle px-4 py-3 text-sm font-medium text-foreground">
          {Number(cobranca) > 0
            ? `${cobranca} colaborador${Number(cobranca) > 1 ? "es" : ""} notificado${Number(cobranca) > 1 ? "s" : ""}.`
            : "Ninguém pendente para notificar."}
        </p>
      )}

      {detail.pending.length > 0 && (
        <form action={remindPendingAction}>
          <input type="hidden" name="announcementId" value={announcementId} />
          <SubmitButton variant="action" className="w-full" pendingLabel="Cobrando…">
            Cobrar pendentes
          </SubmitButton>
        </form>
      )}

      <a
        href={`/pendencias/${announcementId}/export${filial ? `?filial=${filial}` : ""}`}
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Exportar CSV de confirmações
      </a>

      {!isManager && branches.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-sm">
          <Link
            href={`/pendencias/${announcementId}`}
            className={!filial ? "rounded-lg bg-primary px-2.5 py-1 text-primary-foreground" : "rounded-lg px-2.5 py-1 text-muted-foreground hover:bg-muted"}
          >
            Todas as filiais
          </Link>
          {branches.map((b) => (
            <Link
              key={b.id}
              href={{ pathname: `/pendencias/${announcementId}`, query: { filial: b.id } }}
              className={filial === b.id ? "rounded-lg bg-primary px-2.5 py-1 text-primary-foreground" : "rounded-lg px-2.5 py-1 text-muted-foreground hover:bg-muted"}
            >
              {b.name}
            </Link>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-foreground">Pendentes ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguém pendente{filial ? " nesta filial" : ""}.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {pending.map((u) => (
              <Link
                key={u.id}
                href={`/pendencias/colaborador/${u.id}`}
                className="flex items-center justify-between rounded-[var(--radius-card)] border border-border bg-card p-2.5 text-sm shadow-[var(--shadow-card)] hover:bg-muted"
              >
                <span className="font-medium text-foreground">{u.fullName}</span>
                <span className="text-muted-foreground">{branchNameById.get(u.branchId) ?? ""}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-foreground">Confirmados ({confirmed.length})</h2>
        {confirmed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguém confirmou ainda{filial ? " nesta filial" : ""}.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {confirmed.map((u) => (
              <Link
                key={u.id}
                href={`/pendencias/colaborador/${u.id}`}
                className="flex items-center justify-between rounded-[var(--radius-card)] border border-border bg-card p-2.5 text-sm shadow-[var(--shadow-card)] hover:bg-muted"
              >
                <span className="font-medium text-foreground">{u.fullName}</span>
                <span className="text-success">{formatDateTimeSaoPaulo(u.ackedAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
