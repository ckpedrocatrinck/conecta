import { describe, expect, it } from "vitest";
import { isPublicPath, MIDDLEWARE_MATCHER } from "./src/lib/auth/middleware-paths";

describe("middleware matcher (A2-1/A2-3)", () => {
  // Next.js compila o matcher via path-to-regexp, ancorado no inicio/fim da
  // URL — precisamos ancorar aqui tambem, senao o lookahead negativo so'
  // precisa bater em ALGUM ponto da string (ex.: "/api/cron/..." contem uma
  // "/" no meio seguida de algo que nao comeca com "api/cron" e daria falso
  // positivo sem a ancora).
  const matcher = new RegExp(`^${MIDDLEWARE_MATCHER}$`);

  it("nao intercepta /api/cron/* — o Bearer-secret do handler passa a governar sozinho", () => {
    expect(matcher.test("/api/cron/publish-announcements")).toBe(false);
  });

  it("continua nao interceptando /api/auth/* (comportamento preexistente)", () => {
    expect(matcher.test("/api/auth/session")).toBe(false);
  });

  it("continua interceptando rotas normais da aplicacao", () => {
    expect(matcher.test("/comunicados/123")).toBe(true);
    expect(matcher.test("/admin/vagas")).toBe(true);
  });
});

describe("PUBLIC_PATHS (A2-3 — PWA acessivel deslogado)", () => {
  it("libera manifest, offline e os 3 icones do PWA", () => {
    expect(isPublicPath("/manifest.webmanifest")).toBe(true);
    expect(isPublicPath("/offline")).toBe(true);
    expect(isPublicPath("/icon-192.png")).toBe(true);
    expect(isPublicPath("/icon-512.png")).toBe(true);
    expect(isPublicPath("/icon-512-maskable.png")).toBe(true);
  });

  it("nao libera rotas protegidas de verdade", () => {
    expect(isPublicPath("/comunicados")).toBe(false);
    expect(isPublicPath("/admin")).toBe(false);
  });

  it("libera o login e o manifest tenant-scoped (/{slug}/login, /{slug}/manifest) — INC-014", () => {
    expect(isPublicPath("/valeverde/login")).toBe(true);
    expect(isPublicPath("/vale-verde/login")).toBe(true);
    expect(isPublicPath("/vale-verde/manifest")).toBe(true);
  });

  it("nao libera rotas de tenant que nao sejam login/manifest", () => {
    expect(isPublicPath("/valeverde")).toBe(false);
    expect(isPublicPath("/valeverde/comunicados")).toBe(false);
    expect(isPublicPath("/valeverde/admin")).toBe(false);
  });
});
