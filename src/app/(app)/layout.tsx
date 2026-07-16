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
 *
 * Bottom nav fixa (R2, auditoria de usabilidade 2026-07): antes o comentario
 * aqui afirmava "fixa" sem o `<nav>` realmente ser `fixed` — em feed longo/
 * comunicado longo a nav ficava no fim do fluxo, sumindo ao rolar. Agora
 * `BottomNav` (bottom-nav.tsx) e' `fixed inset-x-0 bottom-0`; `min-h-dvh`
 * aqui (nao `min-h-full`) acompanha o encolhimento do viewport quando a
 * barra do Safari aparece/some; `pb-[...]` no `<main>` reserva a altura da
 * nav (~48px + safe-area) pra conteudo nao ficar escondido atras dela. O
 * ajuste fino de Safari nao-instalado (item 1 da Parte 5 da auditoria) fica
 * pro DP-13 — aqui so' o comportamento fixo basico, que ja funciona em
 * standalone/Android/Chrome.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireOnboardedSession();
  const pendingCount = await getCachedPendingAckCount(session.tenantId, session.userId);

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <OfflineBanner />
      <InstallPrompt />
      <AdminHeaderNav role={session.role} />
      <main className="flex flex-1 flex-col pb-[calc(3rem+env(safe-area-inset-bottom))]">{children}</main>
      <AppBottomNav pendingCount={pendingCount} />
    </div>
  );
}
