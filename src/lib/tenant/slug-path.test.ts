import { describe, expect, it } from "vitest";
import { extractTenantSlug, isReservedSegment } from "./slug-path";

describe("extractTenantSlug (INC-014 Bloco 1 — Edge, string puro)", () => {
  it("retorna null para a raiz institucional", () => {
    expect(extractTenantSlug("/")).toBeNull();
    expect(extractTenantSlug("")).toBeNull();
  });

  it("extrai o primeiro segmento como slug candidato", () => {
    expect(extractTenantSlug("/valeverde")).toBe("valeverde");
    expect(extractTenantSlug("/valeverde/comunicados")).toBe("valeverde");
    expect(extractTenantSlug("/vale-verde/admin/pendencias")).toBe("vale-verde");
  });

  it("normaliza para minusculas", () => {
    expect(extractTenantSlug("/ValeVerde")).toBe("valeverde");
  });

  it("descarta segmentos reservados (api, _next)", () => {
    expect(extractTenantSlug("/api/health")).toBeNull();
    expect(extractTenantSlug("/_next/static/chunk.js")).toBeNull();
  });

  it("descarta assets estaticos com ponto (nunca sao slug)", () => {
    expect(extractTenantSlug("/favicon.ico")).toBeNull();
    expect(extractTenantSlug("/icon-192.png")).toBeNull();
    expect(extractTenantSlug("/manifest.webmanifest")).toBeNull();
  });

  it("nao decide existencia — candidato valido inexistente ainda 'passa' aqui (quem 404 e' a camada Node)", () => {
    expect(extractTenantSlug("/empresa-que-nao-existe")).toBe("empresa-que-nao-existe");
  });
});

describe("isReservedSegment", () => {
  it("reserva api e _next", () => {
    expect(isReservedSegment("api")).toBe(true);
    expect(isReservedSegment("_next")).toBe(true);
  });

  it("nao reserva um slug de tenant real", () => {
    expect(isReservedSegment("valeverde")).toBe(false);
  });
});
