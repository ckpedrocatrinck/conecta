import { createHmac } from "node:crypto";

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
