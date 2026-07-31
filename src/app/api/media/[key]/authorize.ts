import type { ActiveSession } from "@/lib/auth/session";

/**
 * Autorizacao por namespace de chave — cada prefixo tem sua propria regra de
 * quem pode ler/escrever. Funcao pura (sem I/O) extraida da rota /api/media
 * para ser testavel em isolamento (INC-017: prova de isolamento por-tenant do
 * namespace branding/):
 * - `avatars/{tenantId}/{userId}`: so' o proprio dono, ver/enviar (INC-003).
 * - `posts/{tenantId}/{postId}/...`: ver e' liberado para qualquer sessao
 *   ativa do tenant (colaborador precisa ver a foto no feed); enviar so'
 *   para admin do mesmo tenant (INC-008).
 * - `branding/{tenantId}/{banner|logo|vagas-banner|beneficios-banner}/{uuid}`:
 *   aparencia da empresa (INC-017 banner/logo; INC-019 estende para banner por
 *   secao). Ver liberado para qualquer sessao ativa do mesmo tenant (colaborador
 *   ve o banner na home/vagas/beneficios e o logo nos cards); enviar so' admin
 *   do mesmo tenant. Mesma regra de `posts/` — dado por-tenant, isolado por
 *   tenantId. O segmento uuid torna cada upload um objeto NOVO: substituir o
 *   banner nao sobrescreve (nem arrisca destruir) o objeto atual antes da
 *   validacao; a troca de key + a remocao do objeto antigo acontece so' no
 *   confirm aprovado. Extensao aditiva (INC-019): "banner" continua sendo so'
 *   o da home — nao ha migracao de key existente, os 2 segmentos novos so'
 *   ampliam o conjunto aceito pelo regex.
 */
export function authorizeMediaKey(key: string, mode: "view" | "upload", session: ActiveSession): boolean {
  const avatarMatch = key.match(/^avatars\/([^/]+)\/([^/]+)$/);
  if (avatarMatch) {
    const [, tenantId, userId] = avatarMatch;
    return tenantId === session.tenantId && userId === session.userId;
  }

  const postMediaMatch = key.match(/^posts\/([^/]+)\/([^/]+)\/[^/]+$/);
  if (postMediaMatch) {
    const [, tenantId] = postMediaMatch;
    if (tenantId !== session.tenantId) return false;
    return mode === "view" || session.role === "admin";
  }

  const brandingMatch = key.match(/^branding\/([^/]+)\/(?:banner|logo|vagas-banner|beneficios-banner)\/[^/]+$/);
  if (brandingMatch) {
    const [, tenantId] = brandingMatch;
    if (tenantId !== session.tenantId) return false;
    return mode === "view" || session.role === "admin";
  }

  return false;
}
