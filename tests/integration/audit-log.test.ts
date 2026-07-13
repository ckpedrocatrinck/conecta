import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { withTenant } from "../../src/lib/db/with-tenant";
import { recordAuditLog, findAuditLogsForTenant } from "../../src/lib/repositories/audit-log.repository";

const ownerDb = new PrismaClient();

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Audit Log Test ${suffix}`,
    slug: `audit-log-test-${suffix}`,
    branchCount: 1,
    userCount: 5,
    cpfSeedOffset: 980,
    includeSampleAnnouncements: false,
  });
}, 60_000);

afterAll(async () => {
  await ownerDb.auditLog.deleteMany({ where: { tenantId: tenant.tenant.id } });
  await ownerDb.post.deleteMany({ where: { tenantId: tenant.tenant.id } });
  await ownerDb.jobOpening.deleteMany({ where: { tenantId: tenant.tenant.id } });
  await ownerDb.user.deleteMany({ where: { tenantId: tenant.tenant.id } });
  await ownerDb.tenant.deleteMany({ where: { id: tenant.tenant.id } });
  await ownerDb.$disconnect();
});

// Conjunto completo pedido pelo INC-007: publicar/editar/arquivar comunicado,
// importar CSV, mudar papel, cobrar pendentes, exportar dados. Cada acao
// abaixo espelha exatamente o que a Server Action correspondente grava (ver
// src/app/admin/**/actions.ts e src/app/pendencias/[announcementId]/**).
const ACTIONS: { action: string; entity: string; metadata?: Record<string, unknown> }[] = [
  { action: "branch.create", entity: "Branch", metadata: { name: "Filial Teste", code: "FT" } },
  { action: "employee.create", entity: "User", metadata: { registrationCode: "MAT-0001" } },
  { action: "employee.update", entity: "User", metadata: { roleChanged: true, previousRole: "employee", newRole: "manager" } },
  { action: "employee.import_csv", entity: "User", metadata: { totalRows: 3, created: 2, updated: 1, errors: [] } },
  { action: "announcement.publish", entity: "Announcement", metadata: { seqNumber: 1, year: 2026 } },
  { action: "announcement.archive", entity: "Announcement" },
  { action: "announcement.remind_pending", entity: "Announcement", metadata: { notifiedCount: 4 } },
  { action: "announcement.export_ack_csv", entity: "Announcement", metadata: { rowCount: 4, branchId: null } },
];

describe("AuditLog cobre o conjunto de acoes administrativas do INC-007", () => {
  it("cada acao grava com o actor correto e fica recuperavel via findAuditLogsForTenant", async () => {
    const actor = tenant.users[0];
    const entries = [];
    for (const spec of ACTIONS) {
      const entityId = randomUUID();
      await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
        recordAuditLog(tx, {
          tenantId: tenant.tenant.id,
          actorUserId: actor.id,
          action: spec.action,
          entity: spec.entity,
          entityId,
          metadata: spec.metadata,
        }),
      );
      entries.push({ ...spec, entityId });
    }

    const logs = await withTenant({ tenantId: tenant.tenant.id }, (tx) => findAuditLogsForTenant(tx, tenant.tenant.id));

    for (const entry of entries) {
      const found = logs.find((l) => l.entityId === entry.entityId && l.action === entry.action);
      expect(found, `esperava entrada de auditoria para ${entry.action}`).toBeDefined();
      expect(found!.entity).toBe(entry.entity);
      expect(found!.actorUserId).toBe(actor.id);
      expect(found!.actorUser?.fullName).toBe(actor.fullName);
      if (entry.metadata) expect(found!.metadata).toEqual(entry.metadata);
    }
  });

  it("acao de sistema (sem actor humano) aparece com actorUserId null", async () => {
    const entityId = randomUUID();
    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      recordAuditLog(tx, {
        tenantId: tenant.tenant.id,
        actorUserId: null,
        action: "announcement.publish_scheduled",
        entity: "Announcement",
        entityId,
        metadata: { seqNumber: 2, year: 2026 },
      }),
    );

    const logs = await withTenant({ tenantId: tenant.tenant.id }, (tx) => findAuditLogsForTenant(tx, tenant.tenant.id));
    const found = logs.find((l) => l.entityId === entityId)!;
    expect(found.actorUserId).toBeNull();
    expect(found.actorUser).toBeNull();
  });

  it("mais recentes primeiro", async () => {
    const logs = await withTenant({ tenantId: tenant.tenant.id }, (tx) => findAuditLogsForTenant(tx, tenant.tenant.id));
    const timestamps = logs.map((l) => l.createdAt.getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });
});
