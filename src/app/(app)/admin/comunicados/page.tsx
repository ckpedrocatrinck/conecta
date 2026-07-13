import Link from "next/link";
import { Megaphone } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "../../../../lib/auth/session";
import { withTenant } from "../../../../lib/db/with-tenant";
import { findAnnouncementsForAdminList, searchAnnouncementIds } from "../../../../lib/repositories/announcement.repository";
import { formatAnnouncementCode } from "../../../../lib/announcements/publish";
import type { AnnouncementStatus } from "@prisma/client";

const STATUS_LABEL: Record<AnnouncementStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendado",
  published: "Publicado",
  archived: "Arquivado",
};

const STATUS_FILTERS: { value: AnnouncementStatus | ""; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "draft", label: "Rascunho" },
  { value: "scheduled", label: "Agendado" },
  { value: "published", label: "Publicado" },
  { value: "archived", label: "Arquivado" },
];

export default async function ComunicadosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await requireAdmin();
  const { q, status } = await searchParams;
  const statusFilter = status && status in STATUS_LABEL ? (status as AnnouncementStatus) : undefined;

  const announcements = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const all = await findAnnouncementsForAdminList(tx, session.tenantId, statusFilter);
    if (!q) return all;
    const matchingIds = new Set(await searchAnnouncementIds(tx, session.tenantId, q));
    return all.filter((a) => matchingIds.has(a.id));
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Comunicados</h1>
        <Link href="/admin/comunicados/novo" className="text-primary underline-offset-4 hover:underline">
          Novo comunicado
        </Link>
      </div>

      <form className="flex flex-wrap items-center gap-3" action="/admin/comunicados">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por título ou corpo..."
          className="h-8 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
        />
        <div className="flex gap-1 text-sm">
          {STATUS_FILTERS.map((f) => (
            <Link
              key={f.value || "todos"}
              href={{ pathname: "/admin/comunicados", query: { ...(q ? { q } : {}), ...(f.value ? { status: f.value } : {}) } }}
              className={
                (status ?? "") === f.value
                  ? "rounded-lg bg-primary px-2.5 py-1 text-primary-foreground"
                  : "rounded-lg px-2.5 py-1 text-muted-foreground hover:bg-muted"
              }
            >
              {f.label}
            </Link>
          ))}
        </div>
      </form>

      {announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhum comunicado encontrado"
          description="Crie um novo comunicado ou ajuste os filtros de busca."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {announcements.map((a) => {
            const latest = a.versions[0];
            return (
              <Link
                key={a.id}
                href={`/admin/comunicados/${a.id}`}
                className="flex items-center justify-between rounded-[var(--radius-card)] border border-border bg-card p-3 text-sm shadow-[var(--shadow-card)] hover:bg-muted"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="font-bold text-foreground">{latest?.title ?? "(sem título)"}</span>
                  <span className="text-muted-foreground">
                    {a.seqNumber != null && a.year != null ? formatAnnouncementCode(a.seqNumber, a.year) : "sem número"}
                    {" · "}
                    {a.category}
                  </span>
                </span>
                <span className="text-muted-foreground">{STATUS_LABEL[a.status]}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
