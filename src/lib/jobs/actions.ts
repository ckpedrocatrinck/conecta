"use server";

import { Prisma } from "@prisma/client";
import { requireOnboardedSession } from "../auth/session";
import { withTenant } from "../db/with-tenant";
import {
  cancelJobApplication,
  createJobApplication,
  findJobApplication,
  findJobOpeningById,
} from "../repositories/job-opening.repository";
import { recordAuditLog } from "../repositories/audit-log.repository";
import { isJobOpeningAcceptingApplications } from "./is-open";

function isUniqueConstraintViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export type ApplyResult = { ok: true } | { ok: false; reason: "not_found" | "closed" };

/**
 * Candidatura em 1 toque (INC-011). Mesma estrutura de 3 camadas de
 * idempotencia do togglePostReactionAction (INC-010): UI desabilita o
 * botao durante a chamada, aqui um check-then-act, e o backstop de banco
 * (P2002 na constraint unica jobOpeningId+userId) tratado como sucesso
 * silencioso — nunca propaga corrida como erro pro usuario.
 *
 * Reavalia `isJobOpeningAcceptingApplications` na propria action (nao so'
 * no filtro de listagem): garante que uma vaga com prazo vencido rejeita
 * candidatura mesmo que o colaborador tenha a tela antiga aberta.
 */
export async function applyToJobOpeningAction(jobOpeningId: string, note: string | null): Promise<ApplyResult> {
  const session = await requireOnboardedSession();

  return withTenant({ tenantId: session.tenantId }, async (tx) => {
    const job = await findJobOpeningById(tx, session.tenantId, jobOpeningId);
    if (!job) return { ok: false, reason: "not_found" };
    if (!isJobOpeningAcceptingApplications(job)) return { ok: false, reason: "closed" };

    const existing = await findJobApplication(tx, session.tenantId, jobOpeningId, session.userId);
    if (!existing) {
      try {
        await createJobApplication(tx, session.tenantId, jobOpeningId, session.userId, note?.trim() || null);
        await recordAuditLog(tx, {
          tenantId: session.tenantId,
          actorUserId: session.userId,
          action: "job_application.create",
          entity: "JobOpening",
          entityId: jobOpeningId,
        });
      } catch (err) {
        if (!isUniqueConstraintViolation(err)) throw err;
      }
    }

    return { ok: true };
  });
}

/**
 * Cancelamento = DELETE fisico (JobApplication nao tem coluna de status,
 * mesmo padrao de removePostReaction). Permitido so' enquanto a vaga
 * segue aceitando candidatura (criterio de aceite "cancelavel enquanto a
 * vaga estiver aberta") — depois de fechada/vencida, a candidatura ja
 * registrada fica congelada como estava (nao ha' o que cancelar de util
 * nesse ponto: RH ja pode estar avaliando).
 */
export async function cancelJobApplicationAction(jobOpeningId: string): Promise<ApplyResult> {
  const session = await requireOnboardedSession();

  return withTenant({ tenantId: session.tenantId }, async (tx) => {
    const job = await findJobOpeningById(tx, session.tenantId, jobOpeningId);
    if (!job) return { ok: false, reason: "not_found" };
    if (!isJobOpeningAcceptingApplications(job)) return { ok: false, reason: "closed" };

    await cancelJobApplication(tx, session.tenantId, jobOpeningId, session.userId);
    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "job_application.cancel",
      entity: "JobOpening",
      entityId: jobOpeningId,
    });

    return { ok: true };
  });
}
