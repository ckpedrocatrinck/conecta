import Link from "next/link";
import { Megaphone, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOnboardedSession } from "../../../lib/auth/session";
import { withTenant } from "../../../lib/db/with-tenant";
import { listAnnouncementsForUser } from "../../../lib/announcements/list-for-user";
import { formatAnnouncementCode } from "../../../lib/announcements/publish";
import type { AnnouncementReaderBadge } from "../../../lib/announcements/reader-state";

const BADGE_LABEL: Record<AnnouncementReaderBadge, string> = {
  novo: "Novo",
  confirmar_leitura: "Confirmar leitura",
  confirmado: "Confirmado",
  lido: "Lido",
};

const BADGE_CLASS: Record<AnnouncementReaderBadge, string> = {
  novo: "bg-primary-subtle text-primary",
  confirmar_leitura: "bg-action text-action-foreground",
  confirmado: "bg-transparent text-success",
  lido: "bg-transparent text-muted-foreground",
};

const TITLE_CLASS: Record<AnnouncementReaderBadge, string> = {
  novo: "font-bold text-foreground",
  confirmar_leitura: "font-bold text-foreground",
  confirmado: "font-normal text-muted-foreground",
  lido: "font-normal text-muted-foreground",
};

export default async function ComunicadosColaboradorPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string }>;
}) {
  const session = await requireOnboardedSession();
  const { q, categoria } = await searchParams;

  const { items, categories } = await withTenant({ tenantId: session.tenantId }, (tx) =>
    listAnnouncementsForUser(tx, session.tenantId, session.userId, { q, category: categoria }),
  );

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Comunicados</h1>

      <form className="flex flex-col gap-3" action="/comunicados">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar comunicados..."
            className="h-12 w-full rounded-lg border border-input bg-transparent pl-9 pr-3 text-base"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-sm">
            <Link
              href={{ pathname: "/comunicados", query: q ? { q } : {} }}
              className={
                !categoria
                  ? "rounded-lg bg-primary px-2.5 py-1 text-primary-foreground"
                  : "rounded-lg px-2.5 py-1 text-muted-foreground hover:bg-muted"
              }
            >
              Todas
            </Link>
            {categories.map((c) => (
              <Link
                key={c}
                href={{ pathname: "/comunicados", query: { ...(q ? { q } : {}), categoria: c } }}
                className={
                  categoria === c
                    ? "rounded-lg bg-primary px-2.5 py-1 text-primary-foreground"
                    : "rounded-lg px-2.5 py-1 text-muted-foreground hover:bg-muted"
                }
              >
                {c}
              </Link>
            ))}
          </div>
        )}
      </form>

      {items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhum comunicado encontrado"
          description="Quando houver comunicados para você, eles aparecem aqui."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(({ announcement, latestVersion, state }) => (
            <Link
              key={announcement.id}
              href={`/comunicados/${announcement.id}`}
              className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-border bg-card p-3 shadow-[var(--shadow-card)] hover:bg-muted"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={TITLE_CLASS[state.badge]}>{latestVersion.title}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE_CLASS[state.badge]}`}>
                  {BADGE_LABEL[state.badge]}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {announcement.seqNumber != null && announcement.year != null
                  ? `${formatAnnouncementCode(announcement.seqNumber, announcement.year)} · `
                  : ""}
                {announcement.category}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
