import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { withTenant } from "../db/with-tenant";
import { findValidSession } from "../repositories/session.repository";
import { findUserById } from "../repositories/user.repository";
import { getTenantBySlug } from "../tenant/resolve-tenant";
import { sessionMatchesTenant } from "../tenant/tenant-access";
import { auth } from "./config";

export type ActiveSession = {
  tenantId: string;
  /** Slug do tenant designado pela URL (autoritativo, resolvido no guard). Use
   * para montar links/redirects tenant-scoped: `/${session.tenantSlug}/...`. */
  tenantSlug: string;
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
      // Valor do JWT; os guards tenant-scoped sobrescrevem pelo slug
      // AUTORITATIVO resolvido da URL (canonical), caso o slug tenha mudado
      // depois do token ser emitido.
      tenantSlug: token.tenantSlug,
      userId: user.id,
      branchId: user.branchId,
      sessionId: token.sessionId,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      privacyAccepted: Boolean(user.privacyAcceptedAt),
    };
  });
});

/**
 * Base de todos os guards tenant-scoped (INC-014 Bloco 3+4 / ADR-010 §4).
 * Resolve o tenant designado pela URL (header interno `x-tenant-slug`, escrito
 * SEMPRE no servidor pelo middleware — o cliente nao injeta) de forma
 * AUTORITATIVA contra o banco, e exige uma sessao valida CUJO tenant e'
 * exatamente esse.
 *
 * Caso cross-tenant (decisao de Pedro): sessao de A numa URL de B -> a sessao
 * de A NAO e' aceita em B; redireciona ao login do tenant da URL, SEM tocar
 * dados do destino. Permissivo na navegacao (leva ao lugar certo), rigido na
 * autenticacao. A barreira final continua sendo RLS + set_config (ADR-003),
 * intocada — a sessao de A nem existe no contexto de B.
 *
 * Retorna a sessao (com `tenantSlug` = slug AUTORITATIVO/canonical da URL) e o
 * slug, para montar redirects tenant-scoped sem reler o header.
 */
async function requireSessionWithSlug(): Promise<{ session: ActiveSession; slug: string }> {
  const headerList = await headers();
  const headerSlug = headerList.get("x-tenant-slug");
  // Sem slug = fora de um subtree /{slug} (nao deve ocorrer: toda rota de
  // produto vive sob [slug]). Defensivo: 404 em vez de vazar para o login.
  if (!headerSlug) notFound();

  const urlTenant = await getTenantBySlug(headerSlug);
  if (!urlTenant) notFound();

  const session = await getActiveSession();
  if (!sessionMatchesTenant(session, urlTenant.id)) {
    // Sem sessao, ou sessao de OUTRO tenant: nao aceita a sessao no tenant da
    // URL — manda ao login do tenant da URL, sem tocar dados do destino.
    redirect(`/${urlTenant.slug}/login`);
  }

  // session != null e session.tenantId === urlTenant.id (type-guard).
  return { session: { ...session, tenantSlug: urlTenant.slug }, slug: urlTenant.slug };
}

/** Exige sessao valida (do tenant da URL), sem exigir onboarding completo —
 * usado pelas proprias paginas de troca de senha/aviso de privacidade (senao
 * criam loop de redirecionamento com requireOnboardedSession). */
export async function requireSession(): Promise<ActiveSession> {
  return (await requireSessionWithSlug()).session;
}

/** Exige sessao valida E onboarding completo (senha trocada, aviso aceito) —
 * usado por toda rota "de verdade" da aplicacao. Redirects tenant-scoped. */
export async function requireOnboardedSession(): Promise<ActiveSession> {
  const { session, slug } = await requireSessionWithSlug();
  if (session.mustChangePassword) redirect(`/${slug}/trocar-senha`);
  if (!session.privacyAccepted) redirect(`/${slug}/aviso-privacidade`);
  return session;
}

export async function requireAdmin(): Promise<ActiveSession> {
  const session = await requireOnboardedSession();
  // /403 permanece global (pagina de erro, sem dado de tenant).
  if (session.role !== "admin") redirect("/403");
  return session;
}

/** Painel de pendencias (INC-006): admin ve todas as filiais, manager so' a
 * propria (ver ActiveSession.branchId). Primeiro guard que aceita `manager`. */
export async function requireAdminOrManager(): Promise<ActiveSession> {
  const session = await requireOnboardedSession();
  if (session.role !== "admin" && session.role !== "manager") redirect("/403");
  return session;
}
