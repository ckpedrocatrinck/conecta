import type { Prisma } from "@prisma/client";

export type CreateAnnouncementAckInput = {
  tenantId: string;
  announcementId: string;
  versionId: string;
  userId: string;
  contentHashAtAck: string;
};

export function createAnnouncementAck(tx: Prisma.TransactionClient, input: CreateAnnouncementAckInput) {
  return tx.announcementAck.create({ data: input });
}

export function findAnnouncementAcksByTenant(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.announcementAck.findMany({ where: { tenantId } });
}

export function findAnnouncementAcksByUser(tx: Prisma.TransactionClient, tenantId: string, userId: string) {
  return tx.announcementAck.findMany({ where: { tenantId, userId } });
}

// Deliberadamente NAO existe updateAnnouncementAck/deleteAnnouncementAck
// neste arquivo — AnnouncementAck e' imutavel (ADR-001 / LGPD). O banco
// tambem recusa a mutacao via trigger, independente da camada de acesso
// (ver prisma/migrations/*_rls_and_triggers/migration.sql).
