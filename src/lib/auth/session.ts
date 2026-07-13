import { cache } from "react";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { withTenant } from "../db/with-tenant";
import { findValidSession } from "../repositories/session.repository";
import { findUserById } from "../repositories/user.repository";
import { auth } from "./config";

export type ActiveSession = {
  tenantId: string;
  userId: string;
  branchId: string;
  sessionId: string;
  role: UserRole;
  mustChangePassword: boolean;
  privacyAccepted: boolean;
};

/**
 * Fonte de verdade de "quem esta logado" (ADR-007). O JWT (auth()) e' so' um
 * ponteiro rapido — a validade real (sessao nao revogada/expirada, usuario
 * ainda ativo) e mustChangePassword/privacyAccepted (que podem ter mudado
 * depois do JWT ser emitido) sao sempre lidos frescos do banco aqui, nunca
 * confiados a partir do token. Chamar em toda Server Component/Server Action
 * de rota protegida — e' o que faz "logout invalida de verdade" ser real.
 *
 * Envolvida em `cache()` (React) para deduplicar dentro do mesmo request: o
 * layout de navegacao (INC-008.5) e a pagina chamam isso independentemente,
 * `cache()` garante que so' uma consulta ao banco roda por navegacao.
 */
export const getActiveSession = cache(async (): Promise<ActiveSession | null> => {
  const jwtSession = await auth();
  const token = jwtSession?.user;
  if (!token?.sessionId || !token.tenantId || !token.id) return null;

  return withTenant({ tenantId: token.tenantId }, async (tx) => {
    const dbSession = await findValidSession(tx, token.sessionId);
    if (!dbSession) return null;

    const user = await findUserById(tx, token.tenantId, token.id);
    if (!user || user.status !== "active") return null;

    return {
      tenantId: token.tenantId,
      userId: user.id,
      branchId: user.branchId,
      sessionId: token.sessionId,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      privacyAccepted: Boolean(user.privacyAcceptedAt),
    };
  });
});

/** Exige sessao valida, sem exigir onboarding completo — usado pelas
 * proprias paginas de troca de senha/aviso de privacidade (senao criam
 * loop de redirecionamento com requireOnboardedSession). */
export async function requireSession(): Promise<ActiveSession> {
  const session = await getActiveSession();
  if (!session) redirect("/login");
  return session;
}

/** Exige sessao valida E onboarding completo (senha trocada, aviso
 * aceito) — usado por toda rota "de verdade" da aplicacao (escopo do
 * INC-003, criterio "fluxo completo ... troca de senha -> aceite -> home"). */
export async function requireOnboardedSession(): Promise<ActiveSession> {
  const session = await requireSession();
  if (session.mustChangePassword) redirect("/trocar-senha");
  if (!session.privacyAccepted) redirect("/aviso-privacidade");
  return session;
}

export async function requireAdmin(): Promise<ActiveSession> {
  const session = await requireOnboardedSession();
  if (session.role !== "admin") redirect("/403");
  return session;
}

/** Painel de pendencias (INC-006): admin ve todas as filiais, manager so' a
 * propria (ver ActiveSession.branchId). Primeiro guard que aceita `manager` —
 * ate o INC-005 esse papel nao tinha nenhuma tela propria. */
export async function requireAdminOrManager(): Promise<ActiveSession> {
  const session = await requireOnboardedSession();
  if (session.role !== "admin" && session.role !== "manager") redirect("/403");
  return session;
}
