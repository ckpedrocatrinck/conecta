import Link from "next/link";
import { requireAdmin } from "../../../lib/auth/session";
import { withTenant } from "../../../lib/db/with-tenant";
import { findAnnouncementsForAdminList } from "../../../lib/repositories/announcement.repository";
import { findJobOpeningsForAdminList } from "../../../lib/repositories/job-opening.repository";
import { findActiveUsersByTenant } from "../../../lib/repositories/user.repository";
import { findBranchesByTenant } from "../../../lib/repositories/branch.repository";
import { findAuditLogsForTenant } from "../../../lib/repositories/audit-log.repository";
import { listAnnouncementPendencySummaries } from "../../../lib/announcements/pending-panel";
import { formatDateTimeSaoPaulo } from "../../../lib/dates/format-datetime";
import { HomeBanner } from "@/components/home/home-banner";
import { StatCard } from "@/components/admin/stat-card";
import { Avatar } from "@/components/ui/avatar";

const RECENT_EVENTS_LIMIT = 6;

export default async function AdminHomePage() {
  const session = await requireAdmin();

  const data = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const [published, jobs, activeUsers, branches, summaries, recentLogs] = await Promise.all([
      findAnnouncementsForAdminList(tx, session.tenantId, "published"),
      findJobOpeningsForAdminList(tx, session.tenantId),
      findActiveUsersByTenant(tx, session.tenantId),
      findBranchesByTenant(tx, session.tenantId),
      listAnnouncementPendencySummaries(tx, session.tenantId),
      findAuditLogsForTenant(tx, session.tenantId, RECENT_EVENTS_LIMIT),
    ]);
    return { published, jobs, activeUsers, branches, summaries, recentLogs };
  });

  const pendingAcksTotal = data.summaries.reduce((sum, s) => sum + s.pendingCount, 0);
  const pendingComunicados = data.summaries.filter((s) => s.pendingCount > 0).length;
  const openJobs = data.jobs.filter((j) => j.status === "open");
  const candidatesTotal = openJobs.reduce((sum, j) => sum + j._count.applications, 0);

  const todayLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-display text-foreground">Início</h1>
        <p className="text-meta text-muted-foreground">Visão geral do Rede Vale Verde · {todayLabel}</p>
      </div>

      <HomeBanner
        imageSrc="/banners/home.png"
        imageAlt="Comunicação que conecta. Informação que transforma. Aqui a informação chega, a equipe se engaja e todos crescem juntos."
        title="Comunicação que conecta."
        subtitle="Informação que transforma."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Ciências pendentes"
          value={pendingAcksTotal}
          hint={pendingComunicados > 0 ? `em ${pendingComunicados} comunicado${pendingComunicados > 1 ? "s" : ""}` : "tudo em dia"}
          accent
        />
        <StatCard
          label="Comunicados publicados"
          value={data.published.length}
          hint={pendingComunicados > 0 ? `${pendingComunicados} aguardam ciência` : undefined}
        />
        <StatCard
          label="Vagas abertas"
          value={openJobs.length}
          hint={`${candidatesTotal} candidato${candidatesTotal !== 1 ? "s" : ""}`}
        />
        <StatCard label="Colaboradores ativos" value={data.activeUsers.length} hint={`${data.branches.length} ${data.branches.length === 1 ? "filial" : "filiais"}`} />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-card-title font-bold text-foreground">Últimos eventos</h2>
          <Link href="/admin/auditoria" className="text-meta font-semibold text-primary underline-offset-4 hover:underline">
            Ver auditoria
          </Link>
        </div>

        {data.recentLogs.length === 0 ? (
          <p className="text-meta text-muted-foreground">Nenhuma ação registrada ainda.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border rounded-[var(--radius-card)] border border-border bg-card shadow-[var(--shadow-card)]">
            {data.recentLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground-soft">
                  {log.action}
                </span>
                <div className="flex flex-1 items-center gap-2 truncate">
                  <Avatar name={log.actorUser?.fullName ?? "Sistema"} size="sm" />
                  <span className="truncate text-meta text-foreground">{log.actorUser?.fullName ?? "Sistema"}</span>
                </div>
                <span className="shrink-0 text-meta text-subtle-foreground">{formatDateTimeSaoPaulo(log.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
