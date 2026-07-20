import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { HomeBanner } from "@/components/home/home-banner";
import { requireAdmin } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { findJobOpeningsForAdminList } from "@/lib/repositories/job-opening.repository";
import { formatDateTimeSaoPaulo } from "@/lib/dates/format-datetime";

const STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  closed: "Fechada",
};

export default async function JobOpeningsPage() {
  const session = await requireAdmin();

  const jobs = await withTenant({ tenantId: session.tenantId }, (tx) => findJobOpeningsForAdminList(tx, session.tenantId));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-display text-foreground">Vagas internas</h1>
          <p className="text-meta text-muted-foreground">Movimentação interna com candidatura de um toque.</p>
        </div>
        <Link href={`/${session.tenantSlug}/admin/vagas/novo`} className={buttonVariants({ variant: "default", size: "touch" })}>
          <Plus aria-hidden="true" />
          Nova vaga
        </Link>
      </div>

      <HomeBanner imageSrc="/banners/vagas.png" imageAlt="" title="Vagas internas" />

      {jobs.length === 0 ? (
        <p className="text-meta text-muted-foreground">Nenhuma vaga criada ainda.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/${session.tenantSlug}/admin/vagas/${job.id}`}
              className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-muted"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant="category">Vaga interna</Badge>
                <span className="inline-flex items-center gap-1.5 text-meta text-muted-foreground">
                  <span
                    className={`size-2 rounded-full ${job.status === "open" ? "bg-primary" : "bg-border-strong"}`}
                    aria-hidden="true"
                  />
                  {STATUS_LABEL[job.status] ?? job.status}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-card-title font-bold text-foreground">{job.title}</span>
                <span className="text-meta text-muted-foreground">{job.branch?.name ?? "Geral"}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-meta text-muted-foreground">
                <span>Prazo {formatDateTimeSaoPaulo(job.deadline)}</span>
                <span>
                  {job._count.applications} candidato{job._count.applications !== 1 ? "s" : ""}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
