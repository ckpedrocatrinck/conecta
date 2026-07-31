import { describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import { authorizeMediaKey } from "./authorize";
import type { ActiveSession } from "@/lib/auth/session";

// Sessao minima para o teste da funcao pura de autorizacao. Só os campos que
// `authorizeMediaKey` le (tenantId, userId, role) importam.
function session(tenantId: string, userId: string, role: UserRole): ActiveSession {
  return {
    tenantId,
    tenantSlug: "slug",
    userId,
    branchId: "branch",
    sessionId: "sess",
    role,
    mustChangePassword: false,
    privacyAccepted: true,
  } as ActiveSession;
}

const TENANT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("authorizeMediaKey — namespace branding/ (INC-017; INC-019 banner por secao)", () => {
  // Key com uuid por upload (objeto novo a cada troca — ver authorize.ts).
  const bannerA = `branding/${TENANT_A}/banner/11111111-1111-1111-1111-111111111111`;
  const logoA = `branding/${TENANT_A}/logo/22222222-2222-2222-2222-222222222222`;
  const vagasBannerA = `branding/${TENANT_A}/vagas-banner/33333333-3333-3333-3333-333333333333`;
  const beneficiosBannerA = `branding/${TENANT_A}/beneficios-banner/44444444-4444-4444-4444-444444444444`;

  it("colaborador do mesmo tenant PODE ver o banner e o logo", () => {
    const s = session(TENANT_A, "u1", "employee");
    expect(authorizeMediaKey(bannerA, "view", s)).toBe(true);
    expect(authorizeMediaKey(logoA, "view", s)).toBe(true);
  });

  it("colaborador do mesmo tenant PODE ver os banners de secao (INC-019)", () => {
    const s = session(TENANT_A, "u1", "employee");
    expect(authorizeMediaKey(vagasBannerA, "view", s)).toBe(true);
    expect(authorizeMediaKey(beneficiosBannerA, "view", s)).toBe(true);
  });

  it("ISOLAMENTO: sessao do tenant B NAO ve banner/logo do tenant A", () => {
    const adminB = session(TENANT_B, "u9", "admin");
    const employeeB = session(TENANT_B, "u8", "employee");
    expect(authorizeMediaKey(bannerA, "view", adminB)).toBe(false);
    expect(authorizeMediaKey(logoA, "view", adminB)).toBe(false);
    expect(authorizeMediaKey(bannerA, "view", employeeB)).toBe(false);
    // Nem enviar por cima do branding de A (WITH CHECK de tenant).
    expect(authorizeMediaKey(bannerA, "upload", adminB)).toBe(false);
    expect(authorizeMediaKey(logoA, "upload", adminB)).toBe(false);
  });

  it("ISOLAMENTO: sessao do tenant B NAO ve/envia banners de secao do tenant A (INC-019)", () => {
    const adminB = session(TENANT_B, "u9", "admin");
    const employeeB = session(TENANT_B, "u8", "employee");
    expect(authorizeMediaKey(vagasBannerA, "view", adminB)).toBe(false);
    expect(authorizeMediaKey(beneficiosBannerA, "view", adminB)).toBe(false);
    expect(authorizeMediaKey(vagasBannerA, "view", employeeB)).toBe(false);
    expect(authorizeMediaKey(beneficiosBannerA, "view", employeeB)).toBe(false);
    expect(authorizeMediaKey(vagasBannerA, "upload", adminB)).toBe(false);
    expect(authorizeMediaKey(beneficiosBannerA, "upload", adminB)).toBe(false);
  });

  it("upload de branding: só admin do mesmo tenant", () => {
    expect(authorizeMediaKey(bannerA, "upload", session(TENANT_A, "u1", "admin"))).toBe(true);
    expect(authorizeMediaKey(logoA, "upload", session(TENANT_A, "u1", "admin"))).toBe(true);
    // Colaborador/gerente do proprio tenant NAO envia branding.
    expect(authorizeMediaKey(bannerA, "upload", session(TENANT_A, "u1", "employee"))).toBe(false);
    expect(authorizeMediaKey(logoA, "upload", session(TENANT_A, "u1", "manager"))).toBe(false);
  });

  it("upload de banners de secao: só admin do mesmo tenant (INC-019)", () => {
    expect(authorizeMediaKey(vagasBannerA, "upload", session(TENANT_A, "u1", "admin"))).toBe(true);
    expect(authorizeMediaKey(beneficiosBannerA, "upload", session(TENANT_A, "u1", "admin"))).toBe(true);
    expect(authorizeMediaKey(vagasBannerA, "upload", session(TENANT_A, "u1", "employee"))).toBe(false);
    expect(authorizeMediaKey(beneficiosBannerA, "upload", session(TENANT_A, "u1", "manager"))).toBe(false);
  });

  it("recusa branding fora do formato {banner|logo|vagas-banner|beneficios-banner}/{uuid}", () => {
    const s = session(TENANT_A, "u1", "admin");
    // tipo fora do conjunto aceito
    expect(authorizeMediaKey(`branding/${TENANT_A}/tema/abc`, "view", s)).toBe(false);
    // sem o segmento do objeto (uuid)
    expect(authorizeMediaKey(`branding/${TENANT_A}/logo`, "view", s)).toBe(false);
    // segmento extra (nao pode aninhar alem do objeto)
    expect(authorizeMediaKey(`branding/${TENANT_A}/logo/a/b`, "view", s)).toBe(false);
  });

  it("REGRESSÃO: key antiga branding/{t}/banner/{uuid} continua autorizada após a extensão do regex (INC-019)", () => {
    const s = session(TENANT_A, "u1", "employee");
    expect(authorizeMediaKey(bannerA, "view", s)).toBe(true);
    expect(authorizeMediaKey(bannerA, "upload", session(TENANT_A, "u1", "admin"))).toBe(true);
  });
});
