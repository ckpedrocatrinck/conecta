import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { findBranchesByTenant } from "@/lib/repositories/branch.repository";
import {
  findApplicantsForJobOpening,
  findJobOpeningWithDetails,
} from "@/lib/repositories/job-opening.repository";
import { toApplicantView } from "@/lib/jobs/build-job-opening-view";
import { normalizeWhatsappNumber } from "@/lib/jobs/whatsapp-contact";
import { formatDateTimeSaoPaulo } from "@/lib/dates/format-datetime";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { EditJobOpeningForm } from "./form";
import { closeJobOpeningAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  obrigatorio: "Preencha cargo, descrição e prazo.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  fechada: "Vaga fechada.",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  closed: "Fechada",
};

function ApplicantPhoneContact({ phone }: { phone: string | null }) {
  if (!phone) {
    return <span className="text-meta text-muted-foreground">Sem telefone cadastrado</span>;
  }

  const { waLink } = normalizeWhatsappNumber(phone);
  if (!waLink) {
    return <span className="text-meta text-muted-foreground">{phone}</span>;
  }

  return (
    <a href={waLink} target="_blank" rel="noopener noreferrer" className="text-meta font-medium text-primary underline">
      {phone} · abrir no WhatsApp
    </a>
  );
}

export default async function JobOpeningDetailPage({
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
    const job = await findJobOpeningWithDetails(tx, session.tenantId, id);
    if (!job) return null;
    const [branches, applicants] = await Promise.all([
      findBranchesByTenant(tx, session.tenantId),
      findApplicantsForJobOpening(tx, session.tenantId, id),
    ]);
    return { job, branches, applicants };
  });

  if (!data) notFound();
  const { job, branches, applicants } = data;
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
  const applicantViews = applicants.map((a) => toApplicantView(a, branchNameById));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display text-foreground">
          {job.title} <span className="text-body font-normal text-muted-foreground">({STATUS_LABEL[job.status]})</span>
        </h1>
        {job.status === "open" && (
          <form action={closeJobOpeningAction}>
            <input type="hidden" name="id" value={job.id} />
            <SubmitButton variant="secondary" size="touch" pendingLabel="Fechando…">
              Fechar vaga
            </SubmitButton>
          </form>
        )}
      </div>

      {erro && ERROR_MESSAGES[erro] && (
        <p role="alert" className="text-meta text-destructive">
          {ERROR_MESSAGES[erro]}
        </p>
      )}
      {salvo === "ok" && <p className="text-meta font-medium text-success">Alterações salvas.</p>}
      {ok && SUCCESS_MESSAGES[ok] && <p className="text-meta font-medium text-success">{SUCCESS_MESSAGES[ok]}</p>}

      <EditJobOpeningForm job={job} branches={branches} />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-card-title font-bold text-foreground">Candidatos ({applicantViews.length})</h2>
          {applicantViews.length > 0 && (
            <a href={`/${session.tenantSlug}/admin/vagas/${job.id}/export`} download>
              <Button type="button" variant="secondary" size="touch">
                Exportar CSV
              </Button>
            </a>
          )}
        </div>

        {applicantViews.length === 0 ? (
          <p className="text-meta text-muted-foreground">Nenhuma candidatura recebida ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {applicantViews.map((a) => (
              <div
                key={a.userId}
                className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-border bg-card p-4 text-body shadow-[var(--shadow-card)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">{a.fullName}</span>
                  <span className="text-meta text-muted-foreground">{formatDateTimeSaoPaulo(a.createdAt)}</span>
                </div>
                <span className="text-meta text-muted-foreground">
                  Matrícula {a.registrationCode} · {a.branchName}
                </span>
                <ApplicantPhoneContact phone={a.phone} />
                {a.note && <p className="text-foreground">{a.note}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
