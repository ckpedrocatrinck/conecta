import type { PrismaClient } from "@prisma/client";

/**
 * Limpeza de tenant de teste (A7-1, auditoria 2026-07): usa
 * `SET LOCAL session_replication_role = 'replica'` dentro de UMA transacao,
 * em vez do antigo `ALTER TABLE announcement_acks DISABLE TRIGGER USER` +
 * try/finally. O toggle antigo era global/persistente (`pg_trigger.tgenabled`,
 * lock ACCESS EXCLUSIVE) — dois arquivos de teste em paralelo (vitest roda
 * arquivos em paralelo por padrao) corriam risco real de um reativar o
 * trigger enquanto o outro ainda estava deletando (a causa raiz documentada
 * do flaky). `SET LOCAL` e' escopado a esta transacao, sem mutar catalogo.
 *
 * Efeito colateral relevante: `session_replication_role='replica'` desativa
 * TODOS os triggers de usuario (os `forbid_*_mutation` de
 * announcement_acks/announcement_versions/audit_logs — INC-002/INC-012.5) E
 * os triggers internos de FK (RI) que implementam `onDelete: Cascade` — ou
 * seja, cascata automatica NAO acontece dentro desta transacao. Por isso a
 * lista abaixo deleta cada tabela de dominio explicitamente por tenantId, em
 * vez de confiar em cascata a partir de `announcement`/`post`/`tenant`. A
 * ordem entre elas deixa de importar (nenhum FK e' verificado sob
 * replica), mas mantemos uma ordem leaf-first por legibilidade.
 */
export async function cleanupTenant(ownerDb: PrismaClient, tenantId: string): Promise<void> {
  await ownerDb.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = 'replica'");

    await tx.notification.deleteMany({ where: { tenantId } });
    await tx.pushSubscription.deleteMany({ where: { tenantId } });
    await tx.announcementAck.deleteMany({ where: { tenantId } });
    await tx.announcementRead.deleteMany({ where: { tenantId } });
    await tx.announcementAudience.deleteMany({ where: { tenantId } });
    await tx.announcementVersion.deleteMany({ where: { tenantId } });
    await tx.announcementSequence.deleteMany({ where: { tenantId } });
    await tx.announcement.deleteMany({ where: { tenantId } });
    await tx.jobApplication.deleteMany({ where: { tenantId } });
    await tx.jobOpening.deleteMany({ where: { tenantId } });
    await tx.benefit.deleteMany({ where: { tenantId } });
    await tx.postReaction.deleteMany({ where: { tenantId } });
    await tx.postMedia.deleteMany({ where: { tenantId } });
    await tx.postPerson.deleteMany({ where: { tenantId } });
    await tx.post.deleteMany({ where: { tenantId } });
    await tx.auditLog.deleteMany({ where: { tenantId } });
    await tx.session.deleteMany({ where: { tenantId } });
    await tx.user.deleteMany({ where: { tenantId } });
    await tx.branch.deleteMany({ where: { tenantId } });
    await tx.tenant.deleteMany({ where: { id: tenantId } });
  });
}
