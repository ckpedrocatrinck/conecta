import { randomUUID } from "node:crypto";
import Papa from "papaparse";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { cleanupTenant } from "../helpers/cleanup-tenant";
import { withTenant } from "../../src/lib/db/with-tenant";
import { publishAnnouncement } from "../../src/lib/announcements/publish";
import { buildAnnouncementAckExportCsv } from "../../src/lib/csv/announcement-ack-export";
import { createAnnouncementDraft } from "../../src/lib/repositories/announcement.repository";
import { createAnnouncementVersion } from "../../src/lib/repositories/announcement-version.repository";
import { replaceAnnouncementAudience } from "../../src/lib/repositories/announcement-audience.repository";
import { createAnnouncementAckIdempotent } from "../../src/lib/repositories/announcement-ack.repository";
import { setEmployeeStatus } from "../../src/lib/repositories/user.repository";

const ownerDb = new PrismaClient();
const UTF8_BOM = "﻿";

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Ack Export Test ${suffix}`,
    slug: `ack-export-test-${suffix}`,
    branchCount: 2,
    userCount: 10,
    cpfSeedOffset: 970,
    includeSampleAnnouncements: false,
  });
}, 60_000);

afterAll(async () => {
  await cleanupTenant(ownerDb, tenant.tenant.id);
  await ownerDb.$disconnect();
});

async function createPublishedRequiresAck(title: string, branchIds: string[] = []) {
  return withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
    const draft = await createAnnouncementDraft(tx, {
      tenantId: tenant.tenant.id,
      category: "seguranca",
      criticality: "requires_ack",
      createdBy: tenant.users[0].id,
    });
    const version = await createAnnouncementVersion(tx, {
      tenantId: tenant.tenant.id,
      announcementId: draft.id,
      title,
      body: "<p>corpo</p>",
      createdBy: tenant.users[0].id,
    });
    if (branchIds.length > 0) {
      await replaceAnnouncementAudience(tx, tenant.tenant.id, draft.id, branchIds);
    }
    const result = await publishAnnouncement(tx, { tenantId: tenant.tenant.id, announcementId: draft.id });
    return { announcementId: draft.id, versionId: version.id, result };
  });
}

function ackAs(userId: string, announcementId: string, versionId: string, hash: string) {
  return withTenant({ tenantId: tenant.tenant.id }, (tx) =>
    createAnnouncementAckIdempotent(tx, {
      tenantId: tenant.tenant.id,
      announcementId,
      versionId,
      userId,
      contentHashAtAck: hash,
    }),
  );
}

describe("export CSV do log de confirmacoes", () => {
  it("BOM + separador ';' + cabecalho + 1 linha por ack, inclusive desligado", async () => {
    const branchA = tenant.branches[0];
    const activeInA = tenant.users.filter((u) => u.branchId === branchA.id && u.status === "active");
    const [emp1, emp2] = activeInA;

    const { announcementId, versionId, result } = await createPublishedRequiresAck("Export — colunas e encoding", [branchA.id]);
    await ackAs(emp1.id, announcementId, versionId, "hash-emp1");
    await ackAs(emp2.id, announcementId, versionId, "hash-emp2");

    // Desligado depois de confirmar: ack permanece valido/exportavel.
    await withTenant({ tenantId: tenant.tenant.id }, (tx) => setEmployeeStatus(tx, tenant.tenant.id, emp2.id, "inactive"));

    const exportedAt = new Date("2026-07-13T12:00:00Z");
    const csvExport = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      buildAnnouncementAckExportCsv(tx, tenant.tenant.id, announcementId, {}, exportedAt),
    );

    expect(csvExport).not.toBeNull();
    expect(csvExport!.csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csvExport!.rowCount).toBe(2);

    const bodyWithoutBom = csvExport!.csv.slice(UTF8_BOM.length);
    const firstLine = bodyWithoutBom.split("\n")[0].trim();
    expect(firstLine).toBe("Colaborador;Matrícula;Filial;Versão;Hash;Confirmado em");

    const parsed = Papa.parse<Record<string, string>>(bodyWithoutBom, { header: true, delimiter: ";", skipEmptyLines: true });
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.data).toHaveLength(2);

    const row1 = parsed.data.find((r) => r.Colaborador === emp1.fullName)!;
    expect(row1.Matrícula).toBe(emp1.registrationCode);
    expect(row1.Filial).toBe(branchA.name);
    expect(row1.Versão).toBe("1");
    expect(row1.Hash).toBe("hash-emp1");
    expect(row1["Confirmado em"]).toMatch(/^\d{2}\/\d{2}\/\d{4},? \d{2}:\d{2}$/);

    const row2 = parsed.data.find((r) => r.Colaborador === emp2.fullName)!;
    expect(row2).toBeDefined();

    expect(result.status).toBe("published");
    if (result.status === "published") {
      expect(csvExport!.filename).toBe(`confirmacoes-CI-${String(result.seqNumber).padStart(2, "0")}-${result.year}-20260713.csv`);
    }
  });

  it("manager so exporta acks de colaboradores da propria filial", async () => {
    const branchA = tenant.branches[0];
    const branchB = tenant.branches[1];
    const empInA = tenant.users.find((u) => u.branchId === branchA.id && u.status === "active")!;
    const empInB = tenant.users.find((u) => u.branchId === branchB.id && u.status === "active")!;

    const { announcementId, versionId } = await createPublishedRequiresAck("Export — filtro de filial");
    await ackAs(empInA.id, announcementId, versionId, "hash-a");
    await ackAs(empInB.id, announcementId, versionId, "hash-b");

    const csvExport = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      buildAnnouncementAckExportCsv(tx, tenant.tenant.id, announcementId, { branchId: branchA.id }, new Date()),
    );

    expect(csvExport!.rowCount).toBe(1);
    expect(csvExport!.csv).toContain(empInA.fullName);
    expect(csvExport!.csv).not.toContain(empInB.fullName);
  });

  it("devolve null para comunicado que nao requer ciencia", async () => {
    const draft = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createAnnouncementDraft(tx, {
        tenantId: tenant.tenant.id,
        category: "geral",
        criticality: "info",
        createdBy: tenant.users[0].id,
      }),
    );

    const csvExport = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      buildAnnouncementAckExportCsv(tx, tenant.tenant.id, draft.id, {}, new Date()),
    );

    expect(csvExport).toBeNull();
  });
});
