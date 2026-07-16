import Link from "next/link";
import { Briefcase } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { CardTemplate } from "@/components/cards/templates";
import { JobApplyButton } from "@/components/jobs/job-apply-button";
import { requireOnboardedSession } from "../../../lib/auth/session";
import { withTenant } from "../../../lib/db/with-tenant";
import { findBranchesByTenant } from "../../../lib/repositories/branch.repository";
import { findOpenJobOpeningsForEmployee, findMyJobApplications } from "../../../lib/repositories/job-opening.repository";
import { findTenantBranding } from "../../../lib/repositories/tenant.repository";
import { jobOpeningToCardData } from "../../../lib/jobs/build-job-opening-view";

export default async function VagasPage({
  searchParams,
}: {
  searchParams: Promise<{ filial?: string }>;
}) {
  const session = await requireOnboardedSession();
  const { filial } = await searchParams;

  const [{ jobs, branches, myApplications }, branding] = await Promise.all([
    withTenant({ tenantId: session.tenantId }, async (tx) => ({
      jobs: await findOpenJobOpeningsForEmployee(tx, session.tenantId, { branchId: filial || undefined }),
      branches: await findBranchesByTenant(tx, session.tenantId),
      myApplications: await findMyJobApplications(tx, session.tenantId, session.userId),
    })),
    findTenantBranding(session.tenantId),
  ]);

  const appliedJobIds = new Set(myApplications.map((a) => a.jobOpeningId));

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Vagas internas</h1>
        <p className="text-sm text-muted-foreground">Candidate-se em 1 toque.</p>
      </div>

      {branches.length > 1 && (
        <div className="flex flex-wrap gap-1.5 text-sm">
          <Link
            href="/vagas"
            className={
              !filial
                ? "inline-flex min-h-12 items-center rounded-lg bg-primary px-3 text-primary-foreground"
                : "inline-flex min-h-12 items-center rounded-lg px-3 text-muted-foreground hover:bg-muted"
            }
          >
            Todas as filiais
          </Link>
          {branches.map((b) => (
            <Link
              key={b.id}
              href={{ pathname: "/vagas", query: { filial: b.id } }}
              className={
                filial === b.id
                  ? "inline-flex min-h-12 items-center rounded-lg bg-primary px-3 text-primary-foreground"
                  : "inline-flex min-h-12 items-center rounded-lg px-3 text-muted-foreground hover:bg-muted"
              }
            >
              {b.name}
            </Link>
          ))}
        </div>
      )}

      {jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Nenhuma vaga aberta no momento"
          description="Novas vagas aparecem aqui assim que forem publicadas pelo RH."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <div key={job.id} className="flex flex-col gap-2">
              <Link href={`/vagas/${job.id}`}>
                <CardTemplate data={jobOpeningToCardData(job, branding)} />
              </Link>
              <JobApplyButton jobOpeningId={job.id} initialApplied={appliedJobIds.has(job.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
