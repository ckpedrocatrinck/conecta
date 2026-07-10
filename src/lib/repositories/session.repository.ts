import type { Prisma } from "@prisma/client";

// Fonte de verdade sobre validade de sessao (ADR-007) — o JWT do Auth.js so
// carrega um ponteiro (id) para a linha aqui. Sempre via withTenant (tx),
// nunca client global (mesma regra de qualquer outro repositorio).

export function createSession(
  tx: Prisma.TransactionClient,
  data: { tenantId: string; userId: string; expiresAt: Date },
) {
  return tx.session.create({ data });
}

export function findValidSession(tx: Prisma.TransactionClient, sessionId: string) {
  return tx.session.findFirst({
    where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
  });
}

export function revokeSession(tx: Prisma.TransactionClient, sessionId: string) {
  return tx.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Revoga as demais sessoes ativas do usuario (exceto a atual, `exceptSessionId`)
 * — usado na troca de senha, para que uma sessao ja aberta em outro
 * dispositivo/navegador nao sobreviva a troca (mesma garantia de "logout de
 * verdade" do ADR-007, aplicada em massa). Nunca revoga a propria sessao que
 * esta fazendo a troca — senao o usuario cai do proprio fluxo de primeiro
 * acesso (troca de senha -> aviso de privacidade -> home) no meio do caminho. */
export function revokeOtherUserSessions(tx: Prisma.TransactionClient, userId: string, exceptSessionId: string) {
  return tx.session.updateMany({
    where: { userId, revokedAt: null, id: { not: exceptSessionId } },
    data: { revokedAt: new Date() },
  });
}
