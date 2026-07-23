import { createHash, createHmac } from "node:crypto";

/**
 * Hash deterministico de CPF com pepper de aplicacao (ADR-006). Permite
 * localizar o usuario no login sem nunca guardar o CPF em claro. O pepper
 * NUNCA vive no banco ou no repositorio — so' em env/secret manager.
 */

export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export function hashCpf(cpf: string, pepper: string | undefined = process.env.CPF_HASH_PEPPER): string {
  if (!pepper) {
    throw new Error("CPF_HASH_PEPPER nao configurado");
  }
  return createHmac("sha256", pepper).update(normalizeCpf(cpf)).digest("hex");
}

/**
 * Valor sentinela irreversivel que substitui o `cpf_hash` de um usuario
 * anonimizado (INC-013 G1 / ADR-006 §3). Deterministico por usuario (torna a
 * anonimizacao idempotente) e 64 hex — cabe em `cpf_hash VarChar(64)` e
 * satisfaz o `@@unique([tenant_id, cpf_hash])` (colisao entre ids distintos e'
 * desprezivel). Derivado SO' do id publico, SEM pepper: por construcao nunca
 * coincide com um `hashCpf()` real (que exige o pepper secreto), entao um
 * usuario anonimizado jamais volta a ser localizavel no login.
 */
export function anonymizedCpfHash(userId: string): string {
  return createHash("sha256").update(`anon:${userId}`).digest("hex");
}
