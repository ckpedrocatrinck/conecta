import { ScrollText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "../../../lib/auth/session";
import { withTenant } from "../../../lib/db/with-tenant";
import { findAuditLogsForTenant } from "../../../lib/repositories/audit-log.repository";
import { formatDateTimeSaoPaulo } from "../../../lib/dates/format-datetime";

export default async function AuditoriaPage() {
  const session = await requireAdmin();

  const logs = await withTenant({ tenantId: session.tenantId }, (tx) => findAuditLogsForTenant(tx, session.tenantId));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Auditoria</h1>

      {logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Nenhuma ação registrada"
          description="Ações administrativas (publicar comunicado, importar CSV, mudar papel, exportar dados...) aparecem aqui."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-border bg-card p-3 text-sm shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-foreground">{log.action}</span>
                <span className="text-muted-foreground">{formatDateTimeSaoPaulo(log.createdAt)}</span>
              </div>
              <span className="text-muted-foreground">
                {log.actorUser?.fullName ?? "Sistema"} · {log.entity} · {log.entityId}
              </span>
              {log.metadata != null && typeof log.metadata === "object" && Object.keys(log.metadata).length > 0 && (
                <span className="flex flex-wrap gap-1.5 text-xs text-subtle-foreground">
                  {Object.entries(log.metadata as Record<string, unknown>).map(([key, value]) => (
                    <span key={key} className="rounded-full bg-muted px-2 py-0.5">
                      {key}: {String(value)}
                    </span>
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
