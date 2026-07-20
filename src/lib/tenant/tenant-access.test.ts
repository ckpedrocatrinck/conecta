import { describe, expect, it } from "vitest";
import { sessionMatchesTenant } from "./tenant-access";

// INC-014 Bloco 3: o coracao do caso cross-tenant, como regra pura. A sessao do
// tenant A NUNCA e' aceita numa URL do tenant B.
describe("sessionMatchesTenant (vinculo sessao <-> tenant)", () => {
  const A = "11111111-1111-1111-1111-111111111111";
  const B = "22222222-2222-2222-2222-222222222222";

  it("aceita a sessao no MESMO tenant da URL", () => {
    expect(sessionMatchesTenant({ tenantId: A }, A)).toBe(true);
  });

  it("REJEITA a sessao do tenant A na URL do tenant B", () => {
    expect(sessionMatchesTenant({ tenantId: A }, B)).toBe(false);
  });

  it("REJEITA ausencia de sessao (JWT ausente/adulterado -> sessao null/undefined)", () => {
    expect(sessionMatchesTenant(null, B)).toBe(false);
    expect(sessionMatchesTenant(undefined, B)).toBe(false);
  });
});
