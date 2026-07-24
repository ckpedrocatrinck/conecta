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

describe("authorizeMediaKey — namespace branding/ (INC-017)", () => {
  const bannerA = `branding/${TENANT_A}/banner`;
  const logoA = `branding/${TENANT_A}/logo`;

  it("colaborador do mesmo tenant PODE ver o banner e o logo", () => {
    const s = session(TENANT_A, "u1", "employee");
    expect(authorizeMediaKey(bannerA, "view", s)).toBe(true);
    expect(authorizeMediaKey(logoA, "view", s)).toBe(true);
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

  it("upload de branding: só admin do mesmo tenant", () => {
    expect(authorizeMediaKey(bannerA, "upload", session(TENANT_A, "u1", "admin"))).toBe(true);
    expect(authorizeMediaKey(logoA, "upload", session(TENANT_A, "u1", "admin"))).toBe(true);
    // Colaborador/gerente do proprio tenant NAO envia branding.
    expect(authorizeMediaKey(bannerA, "upload", session(TENANT_A, "u1", "employee"))).toBe(false);
    expect(authorizeMediaKey(logoA, "upload", session(TENANT_A, "u1", "manager"))).toBe(false);
  });

  it("recusa sufixo de branding fora do conjunto {banner,logo}", () => {
    const s = session(TENANT_A, "u1", "admin");
    expect(authorizeMediaKey(`branding/${TENANT_A}/tema`, "view", s)).toBe(false);
    expect(authorizeMediaKey(`branding/${TENANT_A}/logo/extra`, "view", s)).toBe(false);
  });
});
