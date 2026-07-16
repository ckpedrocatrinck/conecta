import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { cleanupTenant } from "../helpers/cleanup-tenant";
import { withTenant } from "../../src/lib/db/with-tenant";
import { createAnnouncementDraft } from "../../src/lib/repositories/announcement.repository";
import { createAnnouncementVersion } from "../../src/lib/repositories/announcement-version.repository";
import { recordAuditLog } from "../../src/lib/repositories/audit-log.repository";

// A4-1 (auditoria 2026-07): announcement_versions e audit_logs ganharam os
// mesmos triggers forbid_*_mutation que announcement_acks ja tinha desde o
// INC-002 (migration 20260716143002_inc0125_immutability_triggers). Espelha
// exatamente o padrao de teste ja existente pra ack em
// tenant-isolation.test.ts ("AnnouncementAck e' imutavel — garantia
// estrutural").
const ownerDb = new PrismaClient();

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;
let versionId: string;
let auditLogId: string;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Immutability Triggers Test ${suffix}`,
    slug: `immutability-triggers-test-${suffix}`,
    branchCount: 1,
    userCount: 4,
    cpfSeedOffset: 970,
    includeSampleAnnouncements: false,
  });

  await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
    const draft = await createAnnouncementDraft(tx, {
      tenantId: tenant.tenant.id,
      category: "teste",
      criticality: "info",
      createdBy: tenant.users[0].id,
    });
    const version = await createAnnouncementVersion(tx, {
      tenantId: tenant.tenant.id,
      announcementId: draft.id,
      title: "Versao para teste de imutabilidade",
      body: "<p>corpo</p>",
      createdBy: tenant.users[0].id,
    });
    versionId = version.id;

    const log = await recordAuditLog(tx, {
      tenantId: tenant.tenant.id,
      actorUserId: tenant.users[0].id,
      action: "immutability.test_fixture",
      entity: "AuditLog",
      entityId: randomUUID(),
    });
    auditLogId = log.id;
  });
}, 60_000);

afterAll(async () => {
  await cleanupTenant(ownerDb, tenant.tenant.id);
  await ownerDb.$disconnect();
});

describe("announcement_versions e' imutavel — garantia estrutural (A4-1)", () => {
  it("o trigger recusa UPDATE/DELETE mesmo para a role owner, independente de GRANT", async () => {
    await expect(
      ownerDb.announcementVersion.update({ where: { id: versionId }, data: { title: "hack" } }),
    ).rejects.toThrow(/imutavel/i);

    await expect(ownerDb.announcementVersion.delete({ where: { id: versionId } })).rejects.toThrow(/imutavel/i);
  });

  it("o trigger recusa TRUNCATE mesmo para a role owner, sem perda de dados (rollback forcado)", async () => {
    // Contagem escopada ao tenant deste teste (nao count() global) — a
    // suite roda arquivos em paralelo e outros tenants inserem/removem
    // versoes concorrentemente; um count() sem where oscilaria por causa
    // dessa atividade legitima de OUTROS testes, sem relacao com o trigger.
    const before = await ownerDb.announcementVersion.count({ where: { tenantId: tenant.tenant.id } });

    // CASCADE porque announcement_reads/announcement_acks referenciam
    // announcement_versions por FK — sem isso o Postgres recusa o TRUNCATE
    // antes mesmo de chegar no trigger (erro de FK, nao de imutabilidade).
    // O trigger BEFORE STATEMENT dispara e aborta tudo antes de qualquer
    // truncamento real acontecer, entao o CASCADE nunca chega a executar.
    const attempt = ownerDb.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("TRUNCATE announcement_versions CASCADE");
      throw new Error("__force_rollback_sentinel__");
    });

    await expect(attempt).rejects.toThrow(/imutavel/i);

    const after = await ownerDb.announcementVersion.count({ where: { tenantId: tenant.tenant.id } });
    expect(after).toBe(before);
  });
});

describe("audit_logs e' imutavel — garantia estrutural (A4-1)", () => {
  it("o trigger recusa UPDATE/DELETE mesmo para a role owner, independente de GRANT", async () => {
    await expect(
      ownerDb.auditLog.update({ where: { id: auditLogId }, data: { action: "hack" } }),
    ).rejects.toThrow(/imutavel/i);

    await expect(ownerDb.auditLog.delete({ where: { id: auditLogId } })).rejects.toThrow(/imutavel/i);
  });

  it("o trigger recusa TRUNCATE mesmo para a role owner, sem perda de dados (rollback forcado)", async () => {
    const before = await ownerDb.auditLog.count({ where: { tenantId: tenant.tenant.id } });

    const attempt = ownerDb.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("TRUNCATE audit_logs");
      throw new Error("__force_rollback_sentinel__");
    });

    await expect(attempt).rejects.toThrow(/imutavel/i);

    const after = await ownerDb.auditLog.count({ where: { tenantId: tenant.tenant.id } });
    expect(after).toBe(before);
  });
});
