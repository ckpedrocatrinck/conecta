import Link from "next/link";
import { Check, Megaphone, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { filterChipVariants } from "@/components/ui/filter-chip";
import { requireOnboardedSession } from "../../../lib/auth/session";
import { withTenant } from "../../../lib/db/with-tenant";
import { listAnnouncementsForUser } from "../../../lib/announcements/list-for-user";
import { formatAnnouncementCode } from "../../../lib/announcements/publish";
import type { AnnouncementReaderBadge } from "../../../lib/announcements/reader-state";

const TITLE_CLASS: Record<AnnouncementReaderBadge, string> = {
  novo: "font-bold text-foreground",
  confirmar_leitura: "font-bold text-foreground",
  confirmado: "font-normal text-muted-foreground",
  lido: "font-normal text-muted-foreground",
};

/** Estado do comunicado (design-system §2, "três estados inequívocos") — cor
 * E rótulo, via componente Badge. `pending` usa --action-deep (AA com texto
 * branco pequeno), único badge laranja. */
function StateBadge({ badge }: { badge: AnnouncementReaderBadge }) {
  switch (badge) {
    case "novo":
      return (
        <Badge variant="new" dot>
          Novo
        </Badge>
      );
    case "confirmar_leitura":
      return <Badge variant="pending">Confirmar leitura</Badge>;
    case "confirmado":
      return (
        <Badge variant="quiet">
          <Check aria-hidden="true" />
          Confirmado
        </Badge>
      );
    case "lido":
      return (
        <Badge variant="quiet">
          <Check aria-hidden="true" />
          Lido
        </Badge>
      );
  }
}

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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <h1 className="text-display text-foreground">Comunicados</h1>

      <form className="flex flex-col gap-3" action="/comunicados">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            name="q"
            size="lg"
            defaultValue={q}
            placeholder="Buscar comunicados..."
            className="pl-10"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={{ pathname: "/comunicados", query: q ? { q } : {} }}
              className={filterChipVariants({ active: !categoria })}
            >
              Todas
            </Link>
            {categories.map((c) => (
              <Link
                key={c}
                href={{ pathname: "/comunicados", query: { ...(q ? { q } : {}), categoria: c } }}
                className={filterChipVariants({ active: categoria === c })}
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
        <div className="flex flex-col gap-2.5">
          {items.map(({ announcement, latestVersion, state }) => {
            const isRead = state.badge === "confirmado" || state.badge === "lido";
            return (
              <Link
                key={announcement.id}
                href={`/comunicados/${announcement.id}`}
                className={`flex flex-col gap-2 rounded-[var(--radius-card)] border p-4 transition-colors ${
                  isRead
                    ? "border-border bg-muted hover:bg-muted/70"
                    : "border-border bg-card shadow-[var(--shadow-card)] hover:bg-muted"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`text-card-title ${TITLE_CLASS[state.badge]}`}>{latestVersion.title}</span>
                  <StateBadge badge={state.badge} />
                </div>
                <span className="text-meta text-muted-foreground">
                  {announcement.seqNumber != null && announcement.year != null
                    ? `${formatAnnouncementCode(announcement.seqNumber, announcement.year)} · `
                    : ""}
                  {announcement.category}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
