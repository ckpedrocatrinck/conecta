import { withTenant } from "../db/with-tenant";
import { recordAuditLog } from "../repositories/audit-log.repository";
import { findActiveTenantsForAnonymization } from "../repositories/tenant.repository";
import { anonymizeUser, findUsersDueForAnonymization } from "../repositories/user.repository";

export type AnonymizationSweepResult = {
  mode: "dry-run" | "execute";
  /** Quem SERIA (dry-run) ou FOI encontrado como vencido, por tenant. */
  candidates: { tenantId: string; userId: string; deactivatedAt: Date | null }[];
  /** Quem de fato foi anonimizado nesta execucao (vazio em dry-run e em no-op). */
  anonymized: { tenantId: string; userId: string }[];
};

/**
 * Subtrai meses em UTC (deterministico, independente do fuso do processo — as
 * datas vivem em UTC no banco). Base do prazo de retencao: `cutoff = now -
 * retentionMonths`; um desligado cujo `deactivatedAt <= cutoff` venceu.
 */
export function retentionCutoff(now: Date, retentionMonths: number): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - retentionMonths);
  return cutoff;
}

/**
 * Varredura de anonimizacao de desligados vencidos (INC-013 G1 / ADR-006 §3),
 * tenant por tenant. `findActiveTenantsForAnonymization()` e' o unico ponto
 * legitimo de enumeracao cross-tenant (tenants nao tem RLS — a raiz da
 * hierarquia); cada tenant e' processado isolado dentro de um `withTenant`,
 * mesmo padrao do `runScheduledAnnouncementSweep`.
 *
 * `dryRun=true` e' a REDE DE SEGURANCA contra destruicao irreversivel: so'
 * identifica e reporta os candidatos, sem NENHUMA escrita (nem anonimizacao nem
 * AuditLog). `dryRun=false` anonimiza, carimba e registra em AuditLog cada
 * evento. Idempotente: `anonymizeUser` casa 0 linhas em quem ja' foi anonimizado.
 */
export async function runAnonymizationSweep(options: {
  dryRun: boolean;
  now?: Date;
}): Promise<AnonymizationSweepResult> {
  const now = options.now ?? new Date();
  const tenants = await findActiveTenantsForAnonymization();
  const candidates: AnonymizationSweepResult["candidates"] = [];
  const anonymized: AnonymizationSweepResult["anonymized"] = [];

  for (const tenant of tenants) {
    const cutoff = retentionCutoff(now, tenant.retentionMonths);
    await withTenant({ tenantId: tenant.id }, async (tx) => {
      const due = await findUsersDueForAnonymization(tx, tenant.id, cutoff);
      for (const user of due) {
        candidates.push({ tenantId: tenant.id, userId: user.id, deactivatedAt: user.deactivatedAt });
        if (options.dryRun) continue;

        const result = await anonymizeUser(tx, user.id, now);
        if (result.count > 0) {
          await recordAuditLog(tx, {
            tenantId: tenant.id,
            actorUserId: null, // rotina automatica, sem ator humano (como o sweep de comunicados)
            action: "employee.anonymize",
            entity: "User",
            entityId: user.id,
            // Metadata SEM PII (CLAUDE.md): so' a data do desligamento e o prazo
            // aplicado — o nome/CPF ja' foram sobrescritos, nunca sao logados.
            metadata: {
              deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
              retentionMonths: tenant.retentionMonths,
            },
          });
          anonymized.push({ tenantId: tenant.id, userId: user.id });
        }
      }
    });
  }

  return { mode: options.dryRun ? "dry-run" : "execute", candidates, anonymized };
}
