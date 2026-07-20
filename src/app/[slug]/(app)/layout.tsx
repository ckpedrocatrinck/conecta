import { requireOnboardedSession } from "@/lib/auth/session";
import { getCachedPendingAckCount } from "@/lib/announcements/list-for-user";
import { withTenant } from "@/lib/db/with-tenant";
import { findUserById } from "@/lib/repositories/user.repository";
import { findBranchById } from "@/lib/repositories/branch.repository";
import { findTenantName } from "@/lib/repositories/tenant.repository";
import { listAnnouncementPendencySummaries } from "@/lib/announcements/pending-panel";
import { USER_ROLE_LABELS } from "@/lib/users/role-labels";
import { AppBottomNav } from "@/components/nav/app-bottom-nav";
import { AdminHeaderNav, type AdminHeaderData } from "@/components/admin/admin-header-nav";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { InstallPrompt } from "@/components/pwa/install-prompt";

/**
 * Navegacao global (ADR-009 / INC-008.5): resolvida aqui, no servidor, a
 * partir do role da sessao — nao e' escondida no cliente. Guards de rota
 * (requireAdmin/requireAdminOrManager em admin/layout.tsx e
 * pendencias/layout.tsx) continuam sendo a autorizacao de verdade; este
 * layout so' decide o que aparece.
 *
 * Header admin B (DP-13, INC-013.5): para admin/manager, montamos aqui os
 * dados de apresentacao do header (nome/filial/tenant + contagem de supervisao
 * de pendencias) a partir de repositorios de leitura. So' roda para quem ve o
 * header — o colaborador nao paga esse custo.
 *
 * Bottom nav fixa (R2, auditoria de usabilidade 2026-07): `BottomNav` e'
 * `fixed inset-x-0 bottom-0`; `min-h-dvh` aqui acompanha o encolhimento do
 * viewport quando a barra do Safari aparece/some; `pb-[...]` no `<main>`
 * reserva a altura da nav. A partir do INC-013.5 ela some em >=640px para
 * admin/manager (que usam o header B no desktop) — por isso o `sm:pb-0`
 * condicional, pra nao deixar folga morta embaixo no desktop admin.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireOnboardedSession();
  const pendingCount = await getCachedPendingAckCount(session.tenantId, session.userId);

  let headerData: AdminHeaderData | null = null;
  if (session.role !== "employee") {
    const scope = session.role === "manager" ? { branchId: session.branchId } : {};
    const [tenantName, resolved] = await Promise.all([
      findTenantName(session.tenantId),
      withTenant({ tenantId: session.tenantId }, async (tx) => {
        const user = await findUserById(tx, session.tenantId, session.userId);
        const branch = await findBranchById(tx, session.tenantId, session.branchId);
        const summaries = await listAnnouncementPendencySummaries(tx, session.tenantId, scope);
        return {
          userName: user?.fullName ?? "",
          branchName: branch?.name ?? null,
          oversightCount: summaries.filter((s) => s.pendingCount > 0).length,
        };
      }),
    ]);
    headerData = {
      userName: resolved.userName,
      roleLabel: USER_ROLE_LABELS[session.role],
      branchName: resolved.branchName,
      tenantName,
      pendingCount: resolved.oversightCount,
    };
  }

  const reserveBottomNav = session.role === "employee";

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <OfflineBanner />
      <InstallPrompt />
      <AdminHeaderNav role={session.role} data={headerData} slug={session.tenantSlug} />
      <main
        className={
          reserveBottomNav
            ? "flex flex-1 flex-col pb-[calc(3rem+env(safe-area-inset-bottom))]"
            : "flex flex-1 flex-col pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pb-0"
        }
      >
        {children}
      </main>
      <AppBottomNav pendingCount={pendingCount} role={session.role} />
    </div>
  );
}
