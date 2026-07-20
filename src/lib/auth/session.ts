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

/**
 * Guard tenant-scoped (INC-014 Bloco 3 / ADR-010 §4). Exige uma sessao valida
 * CUJO tenant e' exatamente o tenant designado pela URL. Fonte do tenant da
 * URL: o header interno `x-tenant-slug`, escrito SEMPRE no servidor pelo
 * middleware (o cliente nao injeta — ver middleware.ts) e resolvido aqui de
 * forma AUTORITATIVA contra o banco.
 *
 * Caso cross-tenant (decisao de Pedro, ADR-010 §4): se a URL designa um tenant
 * diferente do da sessao (ex.: logado em /A abrindo /B), a sessao de A NAO e'
 * aceita em B — redireciona ao login do tenant da URL, SEM NUNCA acessar dados
 * do destino. Permissivo na navegacao (leva ao lugar certo), rigido na
 * autenticacao (exige login no novo tenant).
 *
 * A barreira final continua sendo RLS + set_config (ADR-003), intocada: mesmo
 * que este guard falhasse, a sessao de A nao existe no contexto de B (a linha
 * Session vive no tenant A) e o RLS default-deny impede leitura cruzada. Este
 * guard e' a aceitacao de sessao na navegacao, uma camada ACIMA da barreira.
 *
 * Sera' chamado pelo layout de /{slug}/(app) quando as rotas migrarem (Bloco
 * 4); ate' la' e' o mecanismo provado por teste (tenant-path-isolation.test.ts).
 */
export async function requireTenantSession(): Promise<ActiveSession> {
  const headerList = await headers();
  const slug = headerList.get("x-tenant-slug");
  // Sem slug na URL = fora de um subtree /{slug}. Nao deve ocorrer depois que
  // as rotas do produto vivem sob [slug] (Bloco 4); cai no login legado.
  if (!slug) redirect("/login");

  const urlTenant = await getTenantBySlug(slug);
  if (!urlTenant) notFound();

  const session = await getActiveSession();
  if (!sessionMatchesTenant(session, urlTenant.id)) {
    // Sem sessao, ou sessao de OUTRO tenant: nao aceita a sessao de origem no
    // tenant da URL — manda ao login do tenant da URL, sem tocar dados.
    redirect(`/${slug}/login`);
  }

  // sessionMatchesTenant (type-guard) garantiu session != null e
  // session.tenantId === urlTenant.id — o contexto de dados a jusante e' o
  // tenant da URL, provado igual ao da sessao.
  return session;
}
