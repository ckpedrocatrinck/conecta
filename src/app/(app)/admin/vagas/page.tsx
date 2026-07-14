import Link from "next/link";
import { requireAdmin } from "../../../../lib/auth/session";
import { withTenant } from "../../../../lib/db/with-tenant";
import { findJobOpeningsForAdminList } from "../../../../lib/repositories/job-opening.repository";
import { formatDateTimeSaoPaulo } from "../../../../lib/dates/format-datetime";

const STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  closed: "Fechada",
};

export default async function JobOpeningsPage() {
  const session = await requireAdmin();

  const jobs = await withTenant({ tenantId: session.tenantId }, (tx) => findJobOpeningsForAdminList(tx, session.tenantId));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Vagas internas</h1>
        <Link href="/admin/vagas/novo" className="text-primary underline-offset-4 hover:underline">
          Nova vaga
        </Link>
      </div>

      {jobs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma vaga criada ainda.</p>}

      <div className="flex flex-col gap-2">
        {jobs.map((job) => (
          <Link
            key={job.id}
            href={`/admin/vagas/${job.id}`}
            className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-muted"
          >
            <span>
              {job.title} <span className="text-muted-foreground">({job.branch?.name ?? "Geral"})</span>
            </span>
            <span className="text-muted-foreground">
              Prazo {formatDateTimeSaoPaulo(job.deadline)} · {job._count.applications} candidato
              {job._count.applications !== 1 ? "s" : ""} · {STATUS_LABEL[job.status] ?? job.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
