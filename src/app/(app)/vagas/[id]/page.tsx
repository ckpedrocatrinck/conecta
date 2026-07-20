import { notFound } from "next/navigation";
import { requireOnboardedSession } from "../../../../lib/auth/session";
import { withTenant } from "../../../../lib/db/with-tenant";
import { findJobOpeningWithDetails, findJobApplication } from "../../../../lib/repositories/job-opening.repository";
import { formatDateTimeSaoPaulo } from "../../../../lib/dates/format-datetime";
import { isJobOpeningAcceptingApplications } from "../../../../lib/jobs/is-open";
import { JobApplicationPanel } from "@/components/jobs/job-application-panel";

export default async function VagaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireOnboardedSession();
  const { id } = await params;

  const data = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const job = await findJobOpeningWithDetails(tx, session.tenantId, id);
    if (!job) return null;
    const myApplication = await findJobApplication(tx, session.tenantId, id, session.userId);
    return { job, myApplication };
  });

  if (!data) notFound();
  const { job, myApplication } = data;
  const canApply = isJobOpeningAcceptingApplications(job);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-display text-foreground">{job.title}</h1>
        <p className="text-meta text-muted-foreground">
          {job.branch?.name ?? "Geral"}
          {job.shift ? ` · Turno ${job.shift}` : ""} · Prazo {formatDateTimeSaoPaulo(job.deadline)}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-label uppercase text-subtle-foreground">Descrição</h2>
        <p className="whitespace-pre-line text-body text-foreground">{job.description}</p>
      </div>

      {job.requirements && (
        <div className="flex flex-col gap-2">
          <h2 className="text-label uppercase text-subtle-foreground">Requisitos</h2>
          <p className="whitespace-pre-line text-body text-foreground">{job.requirements}</p>
        </div>
      )}

      <JobApplicationPanel
        jobOpeningId={job.id}
        canApply={canApply}
        initialApplication={
          myApplication ? { note: myApplication.note, createdAt: myApplication.createdAt.toISOString() } : null
        }
      />
    </div>
  );
}
