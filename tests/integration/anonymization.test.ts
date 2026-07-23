import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { cleanupTenant } from "../helpers/cleanup-tenant";
import { anonymizedCpfHash } from "../../src/lib/crypto/cpf-hash";
import { withTenant } from "../../src/lib/db/with-tenant";
import { runAnonymizationSweep, retentionCutoff } from "../../src/lib/users/anonymize-sweep";
import {
  anonymizeUser,
  findUsersDueForAnonymization,
  setEmployeeStatus,
} from "../../src/lib/repositories/user.repository";

const ownerDb = new PrismaClient();

// Instante fixo de referencia — as datas de desligamento sao relativas a ele,
// e a varredura recebe o mesmo `now` (deterministico, sem depender do relogio).
const NOW = new Date("2026-07-23T12:00:00.000Z");
const DUE_DATE = new Date("2024-01-01T00:00:00.000Z"); // > 24m antes de NOW -> vencido
const RECENT_DATE = new Date("2026-06-01T00:00:00.000Z"); // < 24m antes de NOW -> nao vencido

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Anon Test ${suffix}`,
    slug: `anon-test-${suffix}`,
    branchCount: 1,
    // Acks vao para a 1a metade (users[0..2]); users[1]/users[2] tem ack.
    userCount: 7,
    cpfSeedOffset: 700,
  });
}, 60_000);

afterAll(async () => {
  await cleanupTenant(ownerDb, tenant.tenant.id);
  await ownerDb.$disconnect();
});

/** Estado direto via ownerDb (bypassa RLS de proposito — setup administrativo). */
function setUserState(userId: string, data: { status: "active" | "inactive"; deactivatedAt: Date | null }) {
  return ownerDb.user.update({ where: { id: userId }, data });
}

describe("setEmployeeStatus carimba deactivated_at (INC-013 G1)", () => {
  it("desligar grava a data; reativar limpa para null", async () => {
    const userId = tenant.users[6].id;
    await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
      await setEmployeeStatus(tx, tenant.tenant.id, userId, "inactive", NOW);
    });
    let user = await ownerDb.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.status).toBe("inactive");
    expect(user.deactivatedAt?.toISOString()).toBe(NOW.toISOString());

    await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
      await setEmployeeStatus(tx, tenant.tenant.id, userId, "active");
    });
    user = await ownerDb.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.status).toBe("active");
    expect(user.deactivatedAt).toBeNull();
  });
});

describe("findUsersDueForAnonymization (deteccao de vencidos)", () => {
  it("seleciona so' inactive+vencido+nao-anonimizado; pula recente, ativo e legado sem data", async () => {
    await setUserState(tenant.users[3].id, { status: "inactive", deactivatedAt: DUE_DATE }); // vencido
    await setUserState(tenant.users[4].id, { status: "inactive", deactivatedAt: RECENT_DATE }); // recente
    await setUserState(tenant.users[5].id, { status: "inactive", deactivatedAt: null }); // legado sem data
    // users[0] permanece ativo (admin).

    const cutoff = retentionCutoff(NOW, 24);
    const due = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findUsersDueForAnonymization(tx, tenant.tenant.id, cutoff),
    );
    const dueIds = due.map((u) => u.id);

    expect(dueIds).toContain(tenant.users[3].id);
    expect(dueIds).not.toContain(tenant.users[4].id); // nao vencido
    expect(dueIds).not.toContain(tenant.users[5].id); // legado sem deactivated_at -> nunca anonimiza
    expect(dueIds).not.toContain(tenant.users[0].id); // ativo
  });
});

describe("anonymizeUser: irreversivel, preserva ack e matricula, idempotente", () => {
  it("sobrescreve PII, mantem registration_code, carimba anonymized_at e nao toca o ack", async () => {
    const userId = tenant.users[1].id;
    await setUserState(userId, { status: "inactive", deactivatedAt: DUE_DATE });

    const before = await ownerDb.user.findUniqueOrThrow({ where: { id: userId } });
    const ackBefore = await ownerDb.announcementAck.findFirstOrThrow({ where: { userId } });

    const result = await withTenant({ tenantId: tenant.tenant.id }, (tx) => anonymizeUser(tx, userId, NOW));
    expect(result.count).toBe(1);

    const after = await ownerDb.user.findUniqueOrThrow({ where: { id: userId } });
    // PII sobrescrita
    expect(after.fullName).toBe(`Colaborador Anonimizado #${userId.slice(0, 8)}`);
    expect(after.fullName).not.toBe(before.fullName);
    expect(after.cpfHash).toBe(anonymizedCpfHash(userId));
    expect(after.cpfHash).not.toBe(before.cpfHash);
    expect(after.phone).toBeNull();
    expect(after.email).toBeNull();
    expect(after.photoUrl).toBeNull();
    expect(after.birthDate).toBeNull();
    expect(after.birthdayVisible).toBe(false);
    expect(after.photoVisible).toBe(false);
    expect(after.anonymizedAt?.toISOString()).toBe(NOW.toISOString());
    // Preservado
    expect(after.registrationCode).toBe(before.registrationCode); // vinculo minimo (ADR-006 §3)
    expect(after.status).toBe("inactive"); // continua desligado
    expect(after.id).toBe(before.id); // id imutavel -> FK do ack intacta

    // Ack preservado, integro e ainda vinculado
    const ackAfter = await ownerDb.announcementAck.findFirstOrThrow({ where: { userId } });
    expect(ackAfter.id).toBe(ackBefore.id);
    expect(ackAfter.userId).toBe(userId);
    expect(ackAfter.contentHashAtAck).toBe(ackBefore.contentHashAtAck);
    expect(ackAfter.ackedAt.toISOString()).toBe(ackBefore.ackedAt.toISOString());
  });

  it("e' idempotente: reexecutar nao re-anonimiza (count 0, anonymized_at inalterado)", async () => {
    const userId = tenant.users[1].id;
    const stamped = await ownerDb.user.findUniqueOrThrow({ where: { id: userId } });

    const result = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      anonymizeUser(tx, userId, new Date("2027-01-01T00:00:00.000Z")),
    );
    expect(result.count).toBe(0);

    const after = await ownerDb.user.findUniqueOrThrow({ where: { id: userId } });
    expect(after.anonymizedAt?.toISOString()).toBe(stamped.anonymizedAt?.toISOString());
  });

  it("o ack continua estruturalmente imutavel (controle: update direto dispara o trigger)", async () => {
    const userId = tenant.users[1].id;
    const ack = await ownerDb.announcementAck.findFirstOrThrow({ where: { userId } });
    await expect(
      ownerDb.announcementAck.update({ where: { id: ack.id }, data: { contentHashAtAck: "adulterado" } }),
    ).rejects.toThrow();
  });
});

describe("runAnonymizationSweep: dry-run e' rede de seguranca; execute anonimiza (INC-013 G1)", () => {
  it("dry-run lista o vencido sem NENHUMA escrita; execute anonimiza e audita; 2a execucao no-op", async () => {
    const subject = tenant.users[2].id;
    await setUserState(subject, { status: "inactive", deactivatedAt: DUE_DATE });

    const mine = (rows: { tenantId: string; userId: string }[]) =>
      rows.filter((r) => r.tenantId === tenant.tenant.id).map((r) => r.userId);

    // 1) DRY-RUN: reporta, nao escreve.
    const dry = await runAnonymizationSweep({ dryRun: true, now: NOW });
    expect(dry.mode).toBe("dry-run");
    expect(mine(dry.candidates)).toContain(subject);
    expect(dry.anonymized).toEqual([]);

    const afterDry = await ownerDb.user.findUniqueOrThrow({ where: { id: subject } });
    expect(afterDry.anonymizedAt).toBeNull(); // intacto
    expect(afterDry.cpfHash).not.toBe(anonymizedCpfHash(subject));
    const auditAfterDry = await ownerDb.auditLog.count({
      where: { tenantId: tenant.tenant.id, action: "employee.anonymize", entityId: subject },
    });
    expect(auditAfterDry).toBe(0); // dry-run nao audita

    // 2) EXECUTE: anonimiza + audita.
    const exec = await runAnonymizationSweep({ dryRun: false, now: NOW });
    expect(exec.mode).toBe("execute");
    expect(mine(exec.anonymized)).toContain(subject);

    const afterExec = await ownerDb.user.findUniqueOrThrow({ where: { id: subject } });
    expect(afterExec.anonymizedAt?.toISOString()).toBe(NOW.toISOString());
    expect(afterExec.cpfHash).toBe(anonymizedCpfHash(subject));
    const auditAfterExec = await ownerDb.auditLog.count({
      where: { tenantId: tenant.tenant.id, action: "employee.anonymize", entityId: subject },
    });
    expect(auditAfterExec).toBe(1);

    // Nao vencido e legado NUNCA sao tocados, mesmo em execute.
    const recent = await ownerDb.user.findUniqueOrThrow({ where: { id: tenant.users[4].id } });
    const legacy = await ownerDb.user.findUniqueOrThrow({ where: { id: tenant.users[5].id } });
    expect(recent.anonymizedAt).toBeNull();
    expect(legacy.anonymizedAt).toBeNull();

    // 3) 2a EXECUCAO: idempotente, subject nao reaparece.
    const again = await runAnonymizationSweep({ dryRun: false, now: NOW });
    expect(mine(again.anonymized)).not.toContain(subject);
  });
});
