// Vinculo sessao <-> tenant (INC-014 Bloco 3 / ADR-010 §4). Decisao PURA e
// sincrona de proposito: recebe a sessao ja resolvida e o tenantId designado
// pela URL, e diz se aquela sessao vale nesse tenant. Assim a regra de
// aceitacao (o coracao do caso cross-tenant) e' exaustivamente testavel sem
// contexto de request. Quem chama (requireSession e derivados, tenant-scoped)
// e' que executa o redirect/notFound.
//
// IMPORTANTE: isto NAO e' a barreira final de isolamento — o RLS + set_config
// (ADR-003) sao, e permanecem intocados. Este vinculo governa a ACEITACAO da
// sessao na navegacao: uma sessao do tenant A NAO e' aceita numa URL do tenant
// B (leva ao login de B), e o contexto de dados a jusante e' sempre o tenant da
// URL — que aqui e' provado igual ao da sessao.

/**
 * Type-guard: verdadeiro somente se ha' sessao E o tenant dela e' exatamente o
 * tenant designado pela URL. Sem sessao (inclusive JWT ausente/adulterado que
 * o Auth.js ja rejeitou -> sessao null) ou sessao de outro tenant -> falso.
 */
export function sessionMatchesTenant<T extends { tenantId: string }>(
  session: T | null | undefined,
  urlTenantId: string,
): session is T {
  if (!session) return false;
  return session.tenantId === urlTenantId;
}
