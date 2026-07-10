import { hashPassword, verifyPassword } from "../crypto/password-hash";
import { withTenant } from "../db/with-tenant";
import { changePassword, findUserById } from "../repositories/user.repository";
import { revokeOtherUserSessions } from "../repositories/session.repository";
import type { ActiveSession } from "./session";

export type PasswordChangeOutcome = "ok" | "curta" | "confirmacao" | "atual" | "no-user";

const MIN_PASSWORD_LENGTH = 8;

/** Logica compartilhada entre a troca obrigatoria de primeiro acesso
 * (/trocar-senha) e a troca voluntaria em "Meus dados" (/perfil) — so' o
 * redirecionamento pos-sucesso difere entre as duas telas. */
export async function performPasswordChange(
  session: ActiveSession,
  input: { currentPassword: string; newPassword: string; confirmPassword: string },
): Promise<PasswordChangeOutcome> {
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) return "curta";
  if (input.newPassword !== input.confirmPassword) return "confirmacao";

  return withTenant({ tenantId: session.tenantId }, async (tx) => {
    const user = await findUserById(tx, session.tenantId, session.userId);
    if (!user) return "no-user";

    const validCurrent = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!validCurrent) return "atual";

    const newPasswordHash = await hashPassword(input.newPassword);
    await changePassword(tx, session.userId, newPasswordHash);
    await revokeOtherUserSessions(tx, session.userId, session.sessionId);
    return "ok";
  });
}
