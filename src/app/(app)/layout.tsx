import { requireOnboardedSession } from "../../lib/auth/session";
import { getCachedPendingAckCount } from "../../lib/announcements/list-for-user";
import { AppBottomNav } from "@/components/nav/app-bottom-nav";
import { AdminHeaderNav } from "@/components/admin/admin-header-nav";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { InstallPrompt } from "@/components/pwa/install-prompt";

/**
 * Navegacao global (ADR-009 / INC-008.5): resolvida aqui, no servidor, a
 * partir do role da sessao — nao e' escondida no cliente. Guards de rota
 * (requireAdmin/requireAdminOrManager em admin/layout.tsx e
 * pendencias/layout.tsx) continuam sendo a autorizacao de verdade; este
 * layout so' decide o que aparece.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireOnboardedSession();
  const pendingCount = await getCachedPendingAckCount(session.tenantId, session.userId);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <OfflineBanner />
      <InstallPrompt />
      <AdminHeaderNav role={session.role} />
      <main className="flex flex-1 flex-col">{children}</main>
      <AppBottomNav pendingCount={pendingCount} />
    </div>
  );
}
