// Rate limiter em memoria (INC-013 Bloco B / G5). Fixed-window por chave.
// Piloto single-instance: um Map no processo Node basta. Sem deps, JS puro
// (edge-safe). A interface e' pequena de proposito — trocar por um backing
// store (Redis) depois nao muda os call sites.
//
// TRADE-OFFS (aprovados no kickoff): o estado vive so' em memoria — reseta em
// restart/deploy (aceitavel no piloto: um restart limpa a penalidade, nao abre
// brecha de brute-force em escala de piloto) e nao e' compartilhado entre
// instancias (o piloto e' single-instance).

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = { limit: number; windowMs: number };

/**
 * Peek (NAO incrementa): true se a chave ja' atingiu o limite na janela atual.
 * `now` injetavel para teste (default Date.now()).
 */
export function isRateLimited(key: string, opts: RateLimitOptions, now: number = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) return false;
  return bucket.count >= opts.limit;
}

/**
 * Registra UMA ocorrencia contavel (ex.: uma FALHA de login) para a chave.
 * Abre uma janela nova se nao houver, ou se a anterior expirou.
 */
export function recordAttempt(key: string, opts: RateLimitOptions, now: number = Date.now()): void {
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return;
  }
  bucket.count += 1;
}

/** So' para testes — zera o estado entre casos. */
export function __resetRateLimitStore(): void {
  buckets.clear();
}
