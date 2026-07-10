import bcrypt from "bcryptjs";

// bcrypt (bcryptjs, pura JS — sem dependencia nativa, evita a dor de
// package-lock cross-plataforma do INC-001) satisfaz a regra do CLAUDE.md
// (argon2id/bcrypt). Custo 12 conforme LGPD (>= 12).
const SALT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
