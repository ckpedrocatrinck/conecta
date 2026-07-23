import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

// INC-013 Bloco B / G4 — confirma que os headers de seguranca sao aplicados a
// todas as rotas. Testa a config direto (sem servidor HTTP), no mesmo espirito
// de middleware.test.ts.
describe("headers de seguranca (INC-013 G4)", () => {
  async function getHeaders() {
    const rules = await nextConfig.headers!();
    const rule = rules[0];
    const map = new Map(rule.headers.map((h) => [h.key, h.value]));
    return { rule, map };
  }

  it("aplica os 5 headers a todas as rotas (/:path*)", async () => {
    const { rule, map } = await getHeaders();
    expect(rule.source).toBe("/:path*");
    for (const key of [
      "Strict-Transport-Security",
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
    ]) {
      expect(map.has(key)).toBe(true);
    }
  });

  it("HSTS: max-age longo + includeSubDomains, SEM preload (decisao INC-013)", async () => {
    const { map } = await getHeaders();
    const hsts = map.get("Strict-Transport-Security")!;
    expect(hsts).toContain("max-age=63072000");
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).not.toContain("preload");
  });

  it("CSP: default-src self, nega framing e object; permite midia/icone same-origin", async () => {
    const { map } = await getHeaders();
    const csp = map.get("Content-Security-Policy")!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("worker-src 'self'");
  });

  it("nosniff e X-Frame-Options DENY", async () => {
    const { map } = await getHeaders();
    expect(map.get("X-Content-Type-Options")).toBe("nosniff");
    expect(map.get("X-Frame-Options")).toBe("DENY");
    expect(map.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });
});
