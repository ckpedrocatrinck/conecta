import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { cleanupTenant } from "../helpers/cleanup-tenant";
import { withTenant } from "../../src/lib/db/with-tenant";
import { createAnnouncementDraft } from "../../src/lib/repositories/announcement.repository";
import { createAnnouncementVersion } from "../../src/lib/repositories/announcement-version.repository";
import type { ActiveSession } from "../../src/lib/auth/session";
import { toDatetimeLocalSaoPaulo } from "../../src/lib/dates/format-datetime";

/**
 * INC-020 / DP-23: prova, atraves da propria Server Action (nao da util
 * isolada, ja coberta por format-datetime.test.ts), que
 * scheduleAnnouncementAction usa fromDatetimeLocalSaoPaulo em vez de
 * new Date(valorCru) — o buraco nunca foi a util, foi a action nao chama-la.
 * Mesmo padrao de mock de announcement-create-actions.test.ts (INC-018).
 */
class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect:${url}`);
  }
}

const sessionRef: { current: ActiveSession | null } = { current: null };

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireAdmin: async () => {
    if (!sessionRef.current) throw new Error("sessao de teste nao inicializada");
    return sessionRef.current;
  },
}));

const { scheduleAnnouncementAction } = await import(
  "../../src/app/[slug]/(app)/admin/comunicados/[id]/actions"
);

const ownerDb = new PrismaClient();

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Schedule Action Test ${suffix}`,
    slug: `schedule-action-test-${suffix}`,
    branchCount: 1,
    userCount: 4,
    cpfSeedOffset: 900,
    includeSampleAnnouncements: false,
  });

  sessionRef.current = {
    tenantId: tenant.tenant.id,
    tenantSlug: tenant.tenant.slug,
    userId: tenant.users[0].id,
    branchId: tenant.users[0].branchId,
    sessionId: randomUUID(),
    role: "admin",
    mustChangePassword: false,
    privacyAccepted: true,
  };
}, 60_000);

afterAll(async () => {
  await cleanupTenant(ownerDb, tenant.tenant.id);
  await ownerDb.$disconnect();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function createDraftAnnouncement(): Promise<string> {
  return withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
    const announcement = await createAnnouncementDraft(tx, {
      tenantId: tenant.tenant.id,
      category: "RH",
      criticality: "info",
      createdBy: tenant.users[0].id,
    });
    await createAnnouncementVersion(tx, {
      tenantId: tenant.tenant.id,
      announcementId: announcement.id,
      title: "Rascunho para agendar",
      body: "<p>corpo</p>",
      createdBy: tenant.users[0].id,
    });
    return announcement.id;
  });
}

function formOf(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

async function runAction(formData: FormData): Promise<string> {
  try {
    await scheduleAnnouncementAction(formData);
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("a action terminou sem redirect");
}

describe("scheduleAnnouncementAction — round-trip de fuso via Server Action (INC-020)", () => {
  it("08:00 digitado sob TZ=UTC de processo (cenario que escondia o bug) e' relido como 08:00 em Sao Paulo", async () => {
    vi.stubEnv("TZ", "UTC");
    const id = await createDraftAnnouncement();

    const url = await runAction(formOf({ id, publishAt: "2026-08-14T08:00" }));
    expect(url).toBe(`/${tenant.tenant.slug}/admin/comunicados/${id}?ok=agendado`);

    const announcement = await ownerDb.announcement.findUniqueOrThrow({ where: { id } });
    expect(announcement.status).toBe("scheduled");
    // Se a action ainda usasse new Date(publishAtRaw) cru, sob TZ=UTC o valor
    // gravado seria 08:00Z = 05:00 em Sao Paulo — este assert pegaria isso.
    expect(toDatetimeLocalSaoPaulo(announcement.publishAt as Date)).toBe("2026-08-14T08:00");
  });

  it("data que nao existe (30/fev): rejeita com ?erro=data-invalida, nada muda no comunicado", async () => {
    vi.stubEnv("TZ", "UTC");
    const id = await createDraftAnnouncement();

    const url = await runAction(formOf({ id, publishAt: "2026-02-30T08:00" }));
    expect(url).toBe(`/${tenant.tenant.slug}/admin/comunicados/${id}?erro=data-invalida`);

    const announcement = await ownerDb.announcement.findUniqueOrThrow({ where: { id } });
    expect(announcement.status).toBe("draft");
    expect(announcement.publishAt).toBeNull();
  });

  it("data no passado: comportamento hoje existente (aceita, sem checagem de passado) continua identico apos a troca", async () => {
    vi.stubEnv("TZ", "UTC");
    const id = await createDraftAnnouncement();

    // scheduleAnnouncementAction NUNCA teve checagem de "passado" (diferente
    // de createAndScheduleAnnouncementAction, tela `novo`, INC-018 item 5) —
    // este INC so' troca new Date() por fromDatetimeLocalSaoPaulo, nao
    // introduz validacao nova. Prova que continua aceitando.
    const url = await runAction(formOf({ id, publishAt: "2020-01-02T08:00" }));
    expect(url).toBe(`/${tenant.tenant.slug}/admin/comunicados/${id}?ok=agendado`);

    const announcement = await ownerDb.announcement.findUniqueOrThrow({ where: { id } });
    expect(announcement.status).toBe("scheduled");
    expect(toDatetimeLocalSaoPaulo(announcement.publishAt as Date)).toBe("2020-01-02T08:00");
  });
});
