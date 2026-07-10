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

/** So' registra changed_at quando o valor de fato muda — reenviar o mesmo
 * formulario nao deve "renovar" a data do consentimento (LGPD: registro de
 * quando foi dado/revogado precisa refletir a mudanca real, nao o clique). */
export async function updateConsentToggles(
  tx: Prisma.TransactionClient,
  userId: string,
  data: { birthdayVisible: boolean; photoVisible: boolean },
) {
  const current = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { birthdayVisible: true, photoVisible: true },
  });

  const now = new Date();
  return tx.user.update({
    where: { id: userId },
    data: {
      birthdayVisible: data.birthdayVisible,
      ...(data.birthdayVisible !== current.birthdayVisible ? { birthdayVisibleChangedAt: now } : {}),
      photoVisible: data.photoVisible,
      ...(data.photoVisible !== current.photoVisible ? { photoVisibleChangedAt: now } : {}),
    },
  });
}

export type NewEmployeeData = {
  tenantId: string;
  branchId: string;
  role: "admin" | "manager" | "employee";
  fullName: string;
  registrationCode: string;
  cpfHash: string;
  passwordHash: string;
  birthDate?: Date;
  hiredAt?: Date;
  phone?: string;
  email?: string;
};

export function createEmployee(tx: Prisma.TransactionClient, data: NewEmployeeData) {
  return tx.user.create({
    data: {
      ...data,
      status: "active",
      mustChangePassword: true,
    },
  });
}

export type EmployeeProfileUpdate = {
  branchId: string;
  role: "admin" | "manager" | "employee";
  fullName: string;
  birthDate?: Date | null;
  hiredAt?: Date | null;
  phone?: string | null;
  email?: string | null;
};

/** Atualiza cadastro de um colaborador ja existente — NUNCA mexe em
 * password_hash/must_change_password/cpf_hash (decisao tecnica do INC-003,
 * ver plano: reimport/edicao de cadastro nao pode resetar credenciais de
 * quem ja tem conta). Redefinicao de senha e' acao explicita separada
 * (resetEmployeePassword). */
export function updateEmployeeProfile(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  data: EmployeeProfileUpdate,
) {
  return tx.user.updateMany({ where: { id: userId, tenantId }, data });
}

export function setEmployeeStatus(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  status: "active" | "inactive",
) {
  return tx.user.updateMany({ where: { id: userId, tenantId }, data: { status } });
}

/** Redefine a senha para uma nova provisoria (acao administrativa explicita,
 * separada de updateEmployeeProfile de proposito). */
export function resetEmployeePassword(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  passwordHash: string,
) {
  return tx.user.updateMany({
    where: { id: userId, tenantId },
    data: { passwordHash, mustChangePassword: true, failedLoginAttempts: 0, lockedUntil: null },
  });
}
