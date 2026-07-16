import Link from "next/link";
import { Cake } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { BirthdaySearch } from "@/components/birthdays/birthday-search";
import { requireOnboardedSession } from "../../../lib/auth/session";
import { withTenant } from "../../../lib/db/with-tenant";
import { findBranchesByTenant } from "../../../lib/repositories/branch.repository";
import { findUpcomingBirthdays } from "../../../lib/repositories/user.repository";
import { birthdayWindowMonthDays } from "../../../lib/dates/birthday-window";
import { buildBirthdayListView } from "../../../lib/birthdays/build-birthday-view";

const WINDOW_DAYS = 7;

export default async function AniversariantesPage({
  searchParams,
}: {
  searchParams: Promise<{ filial?: string }>;
}) {
  const session = await requireOnboardedSession();
  const { filial } = await searchParams;
  const monthDays = birthdayWindowMonthDays(new Date(), WINDOW_DAYS);

  const { rows, branches } = await withTenant({ tenantId: session.tenantId }, async (tx) => ({
    rows: await findUpcomingBirthdays(tx, session.tenantId, monthDays, filial || undefined),
    branches: await findBranchesByTenant(tx, session.tenantId),
  }));

  const entries = await buildBirthdayListView(rows, monthDays);
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Aniversariantes</h1>
        <p className="text-sm text-muted-foreground">Hoje e nos próximos {WINDOW_DAYS} dias.</p>
      </div>

      {branches.length > 1 && (
        <div className="flex flex-wrap gap-1.5 text-sm">
          <Link
            href="/aniversariantes"
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
              href={{ pathname: "/aniversariantes", query: { filial: b.id } }}
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

      {entries.length === 0 ? (
        <EmptyState
          icon={Cake}
          title="Nenhum aniversariante nos próximos dias"
          description="Aniversários aparecem aqui automaticamente, sem nenhum trabalho do RH."
        />
      ) : (
        <BirthdaySearch entries={entries} branchNameById={branchNameById} showBranch={!filial} />
      )}
    </div>
  );
}
