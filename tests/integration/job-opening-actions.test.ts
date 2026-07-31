import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { cleanupTenant } from "../helpers/cleanup-tenant";
import { withTenant } from "../../src/lib/db/with-tenant";
import { createJobOpening } from "../../src/lib/repositories/job-opening.repository";
import type { ActiveSession } from "../../src/lib/auth/session";
import { toDatetimeLocalSaoPaulo } from "../../src/lib/dates/format-datetime";

/**
 * INC-020 / DP-23: prova, atraves das proprias Server Actions (nao da util
 * isolada), que createJobOpeningAction/updateJobOpeningAction usam
 * fromDatetimeLocalSaoPaulo em vez de new Date(valorCru) para o prazo da
 * vaga. Mesmo padrao de mock de announcement-create-actions.test.ts (INC-018).
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

const { createJobOpeningAction } = await import(
  "../../src/app/[slug]/(app)/admin/vagas/novo/actions"
);
const { updateJobOpeningAction } = await import(
  "../../src/app/[slug]/(app)/admin/vagas/[id]/actions"
);

const ownerDb = new PrismaClient();

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Job Opening Actions Test ${suffix}`,
    slug: `job-opening-actions-test-${suffix}`,
    branchCount: 1,
    userCount: 4,
    cpfSeedOffset: 950,
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

function formOf(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

async function runAction(action: (formData: FormData) => Promise<void>, formData: FormData): Promise<string> {
  try {
    await action(formData);
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("a action terminou sem redirect");
}

const countJobOpenings = () => ownerDb.jobOpening.count({ where: { tenantId: tenant.tenant.id } });

function seedJob() {
  return withTenant({ tenantId: tenant.tenant.id }, (tx) =>
    createJobOpening(tx, {
      tenantId: tenant.tenant.id,
      title: "Vaga original",
      description: "Descricao original",
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdBy: tenant.users[0].id,
    }),
  );
}

describe("createJobOpeningAction — round-trip de fuso via Server Action (INC-020)", () => {
  it("08:00 digitado sob TZ=UTC de processo (cenario que escondia o bug) e' relido como 08:00 em Sao Paulo", async () => {
    vi.stubEnv("TZ", "UTC");

    const url = await runAction(
      createJobOpeningAction,
      formOf({ title: "Vaga nova", description: "Descricao", deadline: "2026-08-14T08:00" }),
    );

    const match = new RegExp(`^/${tenant.tenant.slug}/admin/vagas/([0-9a-f-]{36})$`).exec(url);
    expect(match, `url inesperada: ${url}`).not.toBeNull();

    const job = await ownerDb.jobOpening.findUniqueOrThrow({ where: { id: match![1] } });
    // Se a action ainda usasse new Date(deadlineRaw) cru, sob TZ=UTC o valor
    // gravado seria 08:00Z = 05:00 em Sao Paulo — este assert pegaria isso.
    expect(toDatetimeLocalSaoPaulo(job.deadline)).toBe("2026-08-14T08:00");
  });

  it("prazo que nao existe (30/fev): rejeita e NADA e' criado", async () => {
    vi.stubEnv("TZ", "UTC");
    const before = await countJobOpenings();

    // Vagas nao tem um erro "data-invalida" proprio (diferente de
    // comunicados/[id]): fromDatetimeLocalSaoPaulo devolve null para
    // "2026-02-30T08:00", o deadline vira falsy, e cai no MESMO ramo do
    // "obrigatorio" que titulo/descricao vazios — por isso o redirect abaixo
    // e' ?erro=obrigatorio, nao um ?erro=data-invalida que nao existe aqui.
    // Documentado explicitamente para este teste nao virar armadilha se um
    // dia alguem introduzir uma mensagem de erro especifica para data de vaga.
    const url = await runAction(
      createJobOpeningAction,
      formOf({ title: "Vaga invalida", description: "Descricao", deadline: "2026-02-30T08:00" }),
    );

    expect(url).toBe(`/${tenant.tenant.slug}/admin/vagas/novo?erro=obrigatorio`);
    expect(await countJobOpenings()).toBe(before);
  });

  it("prazo no passado: comportamento hoje existente (aceito, sem checagem de passado) continua identico apos a troca", async () => {
    vi.stubEnv("TZ", "UTC");

    // createJobOpeningAction NUNCA teve checagem de "passado" — este INC so'
    // troca new Date() por fromDatetimeLocalSaoPaulo, nao introduz validacao
    // nova. Prova que continua aceitando (a vaga so' fica "vencida" via
    // isJobOpeningAcceptingApplications, checagem computada, nao um bloqueio
    // na criacao).
    const url = await runAction(
      createJobOpeningAction,
      formOf({ title: "Vaga no passado", description: "Descricao", deadline: "2020-01-02T08:00" }),
    );

    const match = new RegExp(`^/${tenant.tenant.slug}/admin/vagas/([0-9a-f-]{36})$`).exec(url);
    expect(match, `url inesperada: ${url}`).not.toBeNull();

    const job = await ownerDb.jobOpening.findUniqueOrThrow({ where: { id: match![1] } });
    expect(toDatetimeLocalSaoPaulo(job.deadline)).toBe("2020-01-02T08:00");
  });
});

describe("updateJobOpeningAction — round-trip de fuso via Server Action (INC-020)", () => {
  it("edita o prazo sob TZ=UTC de processo e relê o mesmo horário de Sao Paulo", async () => {
    vi.stubEnv("TZ", "UTC");
    const job = await seedJob();

    const url = await runAction(
      updateJobOpeningAction,
      formOf({
        id: job.id,
        title: job.title,
        description: job.description,
        deadline: "2026-09-01T14:30",
      }),
    );

    expect(url).toBe(`/${tenant.tenant.slug}/admin/vagas/${job.id}?salvo=ok`);

    const updated = await ownerDb.jobOpening.findUniqueOrThrow({ where: { id: job.id } });
    expect(toDatetimeLocalSaoPaulo(updated.deadline)).toBe("2026-09-01T14:30");
  });

  it("prazo invalido na edicao: rejeita (mesmo ramo ?erro=obrigatorio) e nao altera o prazo salvo", async () => {
    vi.stubEnv("TZ", "UTC");
    const job = await seedJob();
    const originalDeadline = job.deadline;

    const url = await runAction(
      updateJobOpeningAction,
      formOf({
        id: job.id,
        title: job.title,
        description: job.description,
        deadline: "2026-02-30T08:00",
      }),
    );

    expect(url).toBe(`/${tenant.tenant.slug}/admin/vagas/${job.id}?erro=obrigatorio`);

    const unchanged = await ownerDb.jobOpening.findUniqueOrThrow({ where: { id: job.id } });
    expect(unchanged.deadline.toISOString()).toBe(originalDeadline.toISOString());
  });
});
