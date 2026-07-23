import { Prisma } from "@prisma/client";
import type { MonthDay } from "../dates/birthday-window";

const LOGIN_LOCKOUT_THRESHOLD = 5;
const LOGIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export function findUsersByTenant(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.user.findMany({ where: { tenantId } });
}

export function findUserById(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.user.findFirst({ where: { id, tenantId } });
}

/** Usuarios ATIVOS do tenant, projecao enxuta — base do denominador de
 * pendencia (INC-006): desligados nunca entram no publico-alvo, mas seus
 * acks historicos (tabela `AnnouncementAck`, imutavel) nao sao afetados. */
export function findActiveUsersByTenant(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.user.findMany({
    where: { tenantId, status: "active" },
    select: { id: true, branchId: true, fullName: true },
  });
}

export function findUserByCpfHash(tx: Prisma.TransactionClient, tenantId: string, cpfHash: string) {
  return tx.user.findFirst({ where: { tenantId, cpfHash } });
}

export function findUserByRegistrationCode(tx: Prisma.TransactionClient, tenantId: string, registrationCode: string) {
  return tx.user.findFirst({ where: { tenantId, registrationCode } });
}

/**
 * Contador de falhas EFETIVO para a proxima tentativa (INC-013 G5 — decaimento).
 * Se a conta esteve travada mas a janela de lockout ja' expirou, recomeca do
 * zero: sem isso, apos os 15 min de trava o `failedLoginAttempts` continuava no
 * limite e a 1a falha seguinte re-travava na hora. Chamado pelo authorize()
 * SO' quando a conta nao esta' mais travada (lockedUntil no passado ou nulo).
 * Puro (now injetavel) para teste. */
export function effectiveFailedAttempts(
  failedLoginAttempts: number,
  lockedUntil: Date | null,
  now: number = Date.now(),
): number {
  if (lockedUntil && lockedUntil.getTime() <= now) return 0;
  return failedLoginAttempts;
}

/** Login com senha errada: incrementa o contador e, ao atingir o limite,
 * tranca a conta por um periodo (rate limit por conta, sem Redis — ver ADR-006).
 * `currentAttempts` e' o contador EFETIVO (ja passado por effectiveFailedAttempts
 * pelo authorize), evitando uma leitura extra. Grava `lockedUntil` SEMPRE (nova
 * trava ao atingir o limite, ou `null` caso contrario) — o `null` limpa uma
 * trava antiga ja' expirada quando o contador reinicia (G5). */
export function registerFailedLogin(tx: Prisma.TransactionClient, userId: string, currentAttempts: number) {
  const attempts = currentAttempts + 1;
  const lockedUntil = attempts >= LOGIN_LOCKOUT_THRESHOLD ? new Date(Date.now() + LOGIN_LOCKOUT_DURATION_MS) : null;
  return tx.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: attempts, lockedUntil },
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

export type UpcomingBirthdayRow = {
  id: string;
  fullName: string;
  photoUrl: string | null;
  photoVisible: boolean;
  branchId: string;
  month: number;
  day: number;
};

/**
 * Aniversariantes da janela `monthDays` (INC-010) — filtro de opt-out
 * (`birthday_visible = true`) e' parte do WHERE, nao um filtro em memoria
 * depois: quem tem `birthday_visible=false` NUNCA sai do banco, entao nenhum
 * consumidor (tela, card, busca por nome) tem a chance de vazar a existencia
 * dessa pessoa. `monthDays` vem de `birthdayWindowMonthDays` (ja' calculado em
 * America/Sao_Paulo) — esta funcao so' compara (mes,dia), sem conhecer fuso.
 * Raw query porque o Prisma nao modela `EXTRACT(MONTH/DAY FROM birth_date)`
 * de forma tipada; parametros sempre via tagged template (nunca concatenacao
 * de string), RLS + tenant_id explicito como em todo repositorio do projeto.
 */
export async function findUpcomingBirthdays(
  tx: Prisma.TransactionClient,
  tenantId: string,
  monthDays: MonthDay[],
  branchId?: string,
): Promise<UpcomingBirthdayRow[]> {
  const monthDayPairs = Prisma.join(
    monthDays.map((md) => Prisma.sql`(${md.month}, ${md.day})`),
    ", ",
  );
  const branchFilter = branchId ? Prisma.sql`AND branch_id = ${branchId}::uuid` : Prisma.empty;

  return tx.$queryRaw<UpcomingBirthdayRow[]>`
    SELECT
      id,
      full_name AS "fullName",
      photo_url AS "photoUrl",
      photo_visible AS "photoVisible",
      branch_id AS "branchId",
      EXTRACT(MONTH FROM birth_date)::int AS month,
      EXTRACT(DAY FROM birth_date)::int AS day
    FROM users
    WHERE tenant_id = ${tenantId}::uuid
      AND status = 'active'
      AND birthday_visible = true
      AND birth_date IS NOT NULL
      AND (EXTRACT(MONTH FROM birth_date)::int, EXTRACT(DAY FROM birth_date)::int) IN (${monthDayPairs})
      ${branchFilter}
    ORDER BY full_name ASC
  `;
}
