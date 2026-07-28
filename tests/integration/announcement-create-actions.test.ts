import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { cleanupTenant } from "../helpers/cleanup-tenant";
import type { ActiveSession } from "../../src/lib/auth/session";
import { toDatetimeLocalSaoPaulo } from "../../src/lib/dates/format-datetime";

/**
 * Testa as Server Actions da tela `novo` de ponta a ponta contra o banco real
 * (INC-018 criterios 4, 5 e "nada e' criado"). Duas dependencias de runtime do
 * Next sao trocadas por dublês, porque nao existem fora de uma request:
 *
 * - `requireAdmin` — a sessao vem de cookie/headers; aqui e' fixada no admin
 *   do tenant de teste. O guard de papel em si e' coberto por
 *   admin-guard-authorization.test.ts.
 * - `redirect` — no Next ele sinaliza por excecao (NEXT_REDIRECT); aqui lanca
 *   um `RedirectSignal` com a URL, que e' justamente o que queremos afirmar
 *   (mensagem de erro na query string vs. redirect para o comunicado criado).
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

const {
  createAndPublishAnnouncementAction,
  createAndScheduleAnnouncementAction,
  createAnnouncementDraftAction,
} = await import("../../src/app/[slug]/(app)/admin/comunicados/novo/actions");

const ownerDb = new PrismaClient();

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Create Actions ${suffix}`,
    slug: `create-actions-${suffix}`,
    branchCount: 2,
    userCount: 4,
    cpfSeedOffset: 700,
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

function formOf(fields: Record<string, string | string[] | undefined>): FormData {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => formData.append(name, v));
    else formData.set(name, value);
  }
  return formData;
}

function validFields(overrides: Record<string, string | string[] | undefined> = {}) {
  return formOf({
    title: "Comunicado da acao composta",
    body: "<p>corpo valido</p>",
    category: "RH",
    criticality: "info",
    ...overrides,
  });
}

/** Roda a action e devolve a URL do redirect (toda action termina em
 * redirect — de sucesso ou de erro). */
async function runAction(action: (formData: FormData) => Promise<void>, formData: FormData): Promise<string> {
  try {
    await action(formData);
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("a action terminou sem redirect");
}

const countAnnouncements = () => ownerDb.announcement.count({ where: { tenantId: tenant.tenant.id } });

/** Futuro em horario de parede de Sao Paulo, no formato do datetime-local —
 * exatamente o que o browser do admin manda no campo "Agendar para". */
function futureDatetimeLocal(hoursAhead = 24): string {
  return toDatetimeLocalSaoPaulo(new Date(Date.now() + hoursAhead * 60 * 60_000));
}

describe("createAndPublishAnnouncementAction", () => {
  it("publica e redireciona para o comunicado com ?ok=publicado", async () => {
    const url = await runAction(createAndPublishAnnouncementAction, validFields({ title: "Publicado pela action" }));

    const match = new RegExp(`^/${tenant.tenant.slug}/admin/comunicados/([0-9a-f-]{36})\\?ok=publicado$`).exec(url);
    expect(match, `url inesperada: ${url}`).not.toBeNull();

    const announcement = await ownerDb.announcement.findFirstOrThrow({ where: { id: match![1] } });
    expect(announcement.status).toBe("published");
    expect(announcement.seqNumber).not.toBeNull();
    expect(announcement.year).not.toBeNull();
  });

  it("titulo vazio: rejeita com mensagem e NADA e' criado", async () => {
    const before = await countAnnouncements();
    const url = await runAction(createAndPublishAnnouncementAction, validFields({ title: "   " }));

    expect(url).toBe(`/${tenant.tenant.slug}/admin/comunicados/novo?erro=obrigatorio`);
    expect(await countAnnouncements()).toBe(before);
  });

  it("corpo que fica vazio DEPOIS da sanitizacao: rejeita e NADA e' criado", async () => {
    const before = await countAnnouncements();

    // "<p></p>" e' o que o editor manda quando o admin nao digitou nada;
    // "<script>" sobrevive ao trim() do cliente mas nao a sanitizacao.
    for (const body of ["<p></p>", "   ", "<script>alert(1)</script>", "<p><br></p>"]) {
      const url = await runAction(createAndPublishAnnouncementAction, validFields({ body }));
      expect(url, `corpo "${body}" deveria ser rejeitado`).toBe(
        `/${tenant.tenant.slug}/admin/comunicados/novo?erro=obrigatorio`,
      );
    }

    expect(await countAnnouncements()).toBe(before);
  });

  it("criticidade fora do dominio: rejeita e NADA e' criado", async () => {
    const before = await countAnnouncements();
    const url = await runAction(createAndPublishAnnouncementAction, validFields({ criticality: "urgentissimo" }));

    expect(url).toBe(`/${tenant.tenant.slug}/admin/comunicados/novo?erro=obrigatorio`);
    expect(await countAnnouncements()).toBe(before);
  });
});

describe("createAndScheduleAnnouncementAction", () => {
  it("agenda com publish_at em UTC a partir do horario de parede de Sao Paulo", async () => {
    const publishAt = futureDatetimeLocal(48);
    const url = await runAction(
      createAndScheduleAnnouncementAction,
      validFields({ title: "Agendado pela action", publishAt }),
    );

    const match = new RegExp(`^/${tenant.tenant.slug}/admin/comunicados/([0-9a-f-]{36})\\?ok=agendado$`).exec(url);
    expect(match, `url inesperada: ${url}`).not.toBeNull();

    const announcement = await ownerDb.announcement.findFirstOrThrow({ where: { id: match![1] } });
    expect(announcement.status).toBe("scheduled");
    expect(announcement.seqNumber).toBeNull();
    expect(announcement.publishAt).not.toBeNull();
    // O instante gravado (UTC), reexibido em Sao Paulo, e' exatamente o
    // horario de parede que o admin digitou — nem 3h adiantado nem atrasado.
    expect(toDatetimeLocalSaoPaulo(announcement.publishAt as Date)).toBe(publishAt);
  });

  it("data no passado: rejeita com mensagem e NADA e' criado", async () => {
    const before = await countAnnouncements();
    const url = await runAction(
      createAndScheduleAnnouncementAction,
      validFields({ title: "Agendado no passado", publishAt: "2020-01-02T08:00" }),
    );

    expect(url).toBe(`/${tenant.tenant.slug}/admin/comunicados/novo?erro=data-no-passado`);
    expect(await countAnnouncements()).toBe(before);
  });

  it("data ausente ou invalida: rejeita com mensagem e NADA e' criado", async () => {
    const before = await countAnnouncements();

    for (const publishAt of ["", "amanha de manha", "2026-02-30T08:00"]) {
      const url = await runAction(createAndScheduleAnnouncementAction, validFields({ publishAt }));
      expect(url, `data "${publishAt}" deveria ser rejeitada`).toBe(
        `/${tenant.tenant.slug}/admin/comunicados/novo?erro=data-invalida`,
      );
    }

    expect(await countAnnouncements()).toBe(before);
  });

  it("valida o conteudo ANTES da data — corpo vazio nao chega a olhar publish_at", async () => {
    const before = await countAnnouncements();
    const url = await runAction(
      createAndScheduleAnnouncementAction,
      validFields({ body: "<p></p>", publishAt: "2020-01-02T08:00" }),
    );

    expect(url).toBe(`/${tenant.tenant.slug}/admin/comunicados/novo?erro=obrigatorio`);
    expect(await countAnnouncements()).toBe(before);
  });
});

describe("createAnnouncementDraftAction — inalterado (nao-regressao)", () => {
  it("salva rascunho sem numero e redireciona para o comunicado, sem ?ok=", async () => {
    const url = await runAction(createAnnouncementDraftAction, validFields({ title: "Rascunho pela action" }));

    const match = new RegExp(`^/${tenant.tenant.slug}/admin/comunicados/([0-9a-f-]{36})$`).exec(url);
    expect(match, `url inesperada: ${url}`).not.toBeNull();

    const announcement = await ownerDb.announcement.findFirstOrThrow({ where: { id: match![1] } });
    expect(announcement.status).toBe("draft");
    expect(announcement.seqNumber).toBeNull();
    expect(announcement.year).toBeNull();
    expect(await ownerDb.announcementVersion.count({ where: { announcementId: announcement.id } })).toBe(1);
  });

  it("rascunho ignora publish_at, mesmo no passado (nao e' caminho de agendamento)", async () => {
    const url = await runAction(
      createAnnouncementDraftAction,
      validFields({ title: "Rascunho com data no passado", publishAt: "2020-01-02T08:00" }),
    );

    const match = new RegExp(`^/${tenant.tenant.slug}/admin/comunicados/([0-9a-f-]{36})$`).exec(url);
    expect(match, `url inesperada: ${url}`).not.toBeNull();

    const announcement = await ownerDb.announcement.findFirstOrThrow({ where: { id: match![1] } });
    expect(announcement.status).toBe("draft");
    expect(announcement.publishAt).toBeNull();
  });
});
