import type { Prisma } from "@prisma/client";

const LOGIN_LOCKOUT_THRESHOLD = 5;
const LOGIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export function findUsersByTenant(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.user.findMany({ where: { tenantId } });
}

export function findUserById(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.user.findFirst({ where: { id, tenantId } });
}

export function findUserByCpfHash(tx: Prisma.TransactionClient, tenantId: string, cpfHash: string) {
  return tx.user.findFirst({ where: { tenantId, cpfHash } });
}

export function findUserByRegistrationCode(tx: Prisma.TransactionClient, tenantId: string, registrationCode: string) {
  return tx.user.findFirst({ where: { tenantId, registrationCode } });
}

/** Login com senha errada: incrementa o contador e, ao atingir o limite,
 * tranca a conta por um periodo (rate limit sem Redis — ver plano do INC-003).
 * `currentAttempts` vem do registro ja lido pelo authorize() antes de chamar
 * verifyPassword — evita uma leitura extra so' para saber o contador atual. */
export function registerFailedLogin(tx: Prisma.TransactionClient, userId: string, currentAttempts: number) {
  const attempts = currentAttempts + 1;
  const lockedUntil = attempts >= LOGIN_LOCKOUT_THRESHOLD ? new Date(Date.now() + LOGIN_LOCKOUT_DURATION_MS) : undefined;
  return tx.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: attempts, ...(lockedUntil ? { lockedUntil } : {}) },
  });
}

export function registerSuccessfulLogin(tx: Prisma.TransactionClient, userId: string) {
  return tx.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}

export function changePassword(tx: Prisma.TransactionClient, userId: string, passwordHash: string) {
  return tx.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
}

export function acceptPrivacyNotice(tx: Prisma.TransactionClient, userId: string, noticeVersion: string) {
  return tx.user.update({
    where: { id: userId },
    data: { privacyAcceptedAt: new Date(), privacyNoticeVersion: noticeVersion },
  });
}

export function updatePhotoUrl(tx: Prisma.TransactionClient, userId: string, photoUrl: string) {
  return tx.user.update({ where: { id: userId }, data: { photoUrl } });
}

export function updateConsentToggles(
  tx: Prisma.TransactionClient,
  userId: string,
  data: { birthdayVisible?: boolean; photoVisible?: boolean },
) {
  return tx.user.update({ where: { id: userId }, data });
}
