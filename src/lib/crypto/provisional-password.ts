import { randomInt } from "node:crypto";

// Alfabeto sem caracteres ambiguos (sem 0/O, 1/I/l) — a senha e' lida em voz
// alta ou escrita a mao pelo RH na hora de repassar ao colaborador.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const LENGTH = 10;

/** Gera uma senha provisoria (import CSV / cadastro manual, escopo do
 * INC-003). Nunca persistida em claro nem logada — so' retornada uma vez na
 * resposta da acao que a gerou, para o RH repassar ao colaborador. */
export function generateProvisionalPassword(): string {
  let password = "";
  for (let i = 0; i < LENGTH; i++) {
    password += ALPHABET[randomInt(ALPHABET.length)];
  }
  return password;
}
