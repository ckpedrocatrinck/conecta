import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminOrManager } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { getUserPendencyHistory } from "@/lib/announcements/pending-panel";
import { formatAnnouncementCode } from "@/lib/announcements/publish";
import { formatAnnouncementCategory } from "@/lib/announcements/category-labels";
import { formatDateTimeSaoPaulo } from "@/lib/dates/format-datetime";

export default async function PendenciaColaboradorPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await requireAdminOrManager();
  const isManager = session.role === "manager";
  const { userId } = await params;

  const history = await withTenant({ tenantId: session.tenantId }, (tx) =>
    getUserPendencyHistory(tx, session.tenantId, userId, { branchId: isManager ? session.branchId : undefined }),
  );

  if (!history) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-display text-foreground">{history.user.fullName}</h1>

      {history.items.length === 0 ? (
        <p className="text-meta text-muted-foreground">Nenhum comunicado com exigência de ciência para este colaborador.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {history.items.map((item) => (
            <Link
              key={item.announcement.id}
              href={`/${session.tenantSlug}/pendencias/${item.announcement.id}`}
              className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-border bg-card p-4 text-body shadow-[var(--shadow-card)] transition-colors hover:bg-muted"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground">
                  {item.announcement.seqNumber != null && item.announcement.year != null
                    ? formatAnnouncementCode(item.announcement.seqNumber, item.announcement.year)
                    : "sem número"}
                  {" · "}
                  {formatAnnouncementCategory(item.announcement.category)}
                </span>
                <span className={`text-meta font-bold ${item.ackSatisfied ? "text-success" : "text-action"}`}>
                  {item.ackSatisfied ? "Confirmado" : "Pendente"}
                </span>
              </div>
              <span className="text-meta text-muted-foreground">
                {item.ackSatisfied && item.lastAckedAt
                  ? `Confirmado em ${formatDateTimeSaoPaulo(item.lastAckedAt)}`
                  : item.wasReopened
                    ? "Pendência reaberta por atualização material"
                    : "Aguardando confirmação"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
