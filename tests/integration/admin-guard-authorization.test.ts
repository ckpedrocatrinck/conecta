import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * INC-008.5 so' resolve o que a navegacao MOSTRA por papel — a autorizacao
 * de verdade continua nos guards requireAdmin/requireAdminOrManager
 * (src/lib/auth/session.ts), chamados pelos layouts de admin/pendencias.
 * Este teste prova isso isoladamente: mocka sessao/usuario/redirect e
 * chama os guards direto, sem precisar de banco real nem de servidor HTTP.
 *
 * vi.resetModules() + import dinamico por teste garante uma instancia nova
 * do modulo (e do cache() do React que envolve getActiveSession) a cada
 * caso, para um cenario de papel nao vazar cache para o proximo.
 */

const mocks = vi.hoisted(() => ({
  authMock: vi.fn(),
  findValidSessionMock: vi.fn(),
  findUserByIdMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  // INC-014: os guards agora resolvem o tenant da URL (header x-tenant-slug ->
  // getTenantBySlug) e exigem que a sessao seja DESSE tenant. Aqui o tenant da
  // URL bate com o da sessao (tenant-1) — o foco deste teste e' a autorizacao
  // por PAPEL, nao o caso cross-tenant (coberto em tenant-path-isolation).
  getTenantBySlugMock: vi.fn(async () => ({ id: "tenant-1", slug: "tenant-1", name: "Tenant 1" })),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirectMock, notFound: mocks.notFoundMock }));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (key: string) => (key === "x-tenant-slug" ? "tenant-1" : null) }),
}));
vi.mock("../../src/lib/tenant/resolve-tenant", () => ({ getTenantBySlug: mocks.getTenantBySlugMock }));
vi.mock("../../src/lib/db/with-tenant", () => ({
  withTenant: (_ctx: unknown, callback: (tx: unknown) => unknown) => callback({}),
}));
vi.mock("../../src/lib/repositories/session.repository", () => ({
  findValidSession: mocks.findValidSessionMock,
}));
vi.mock("../../src/lib/repositories/user.repository", () => ({
  findUserById: mocks.findUserByIdMock,
}));
vi.mock("../../src/lib/auth/config", () => ({ auth: mocks.authMock }));

function mockSessionFor(role: "admin" | "manager" | "employee") {
  mocks.authMock.mockResolvedValue({ user: { sessionId: "session-1", tenantId: "tenant-1", id: "user-1" } });
  mocks.findValidSessionMock.mockResolvedValue({ id: "session-1" });
  mocks.findUserByIdMock.mockResolvedValue({
    id: "user-1",
    branchId: "branch-1",
    role,
    status: "active",
    mustChangePassword: false,
    privacyAcceptedAt: new Date(),
  });
}

beforeEach(() => {
  vi.resetModules();
  mocks.authMock.mockReset();
  mocks.findValidSessionMock.mockReset();
  mocks.findUserByIdMock.mockReset();
  mocks.redirectMock.mockClear();
});

describe("requireAdmin", () => {
  it("bloqueia employee que force /admin/* por URL (redireciona para /403)", async () => {
    mockSessionFor("employee");
    const { requireAdmin } = await import("../../src/lib/auth/session");
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/403");
    expect(mocks.redirectMock).toHaveBeenCalledWith("/403");
  });

  it("bloqueia manager (menu admin completo e' so' pra admin)", async () => {
    mockSessionFor("manager");
    const { requireAdmin } = await import("../../src/lib/auth/session");
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/403");
  });

  it("deixa admin passar sem redirecionar", async () => {
    mockSessionFor("admin");
    const { requireAdmin } = await import("../../src/lib/auth/session");
    const session = await requireAdmin();
    expect(session.role).toBe("admin");
    expect(mocks.redirectMock).not.toHaveBeenCalled();
  });
});

describe("requireAdminOrManager (Pendencias)", () => {
  it("bloqueia employee que force /pendencias por URL", async () => {
    mockSessionFor("employee");
    const { requireAdminOrManager } = await import("../../src/lib/auth/session");
    await expect(requireAdminOrManager()).rejects.toThrow("REDIRECT:/403");
  });

  it("deixa manager passar (acesso a Pendencias do ADR-009)", async () => {
    mockSessionFor("manager");
    const { requireAdminOrManager } = await import("../../src/lib/auth/session");
    const session = await requireAdminOrManager();
    expect(session.role).toBe("manager");
    expect(mocks.redirectMock).not.toHaveBeenCalled();
  });

  it("deixa admin passar", async () => {
    mockSessionFor("admin");
    const { requireAdminOrManager } = await import("../../src/lib/auth/session");
    const session = await requireAdminOrManager();
    expect(session.role).toBe("admin");
  });
});
