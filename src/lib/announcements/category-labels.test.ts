import { describe, expect, it } from "vitest";
import { formatAnnouncementCategory } from "./category-labels";

describe("formatAnnouncementCategory (INC-027 Bloco 3.5)", () => {
  it("traduz as categorias conhecidas para rótulo pt-BR legível", () => {
    expect(formatAnnouncementCategory("rh")).toBe("RH");
    expect(formatAnnouncementCategory("seguranca")).toBe("Segurança");
    expect(formatAnnouncementCategory("operacional")).toBe("Operacional");
    expect(formatAnnouncementCategory("aviso")).toBe("Aviso");
    expect(formatAnnouncementCategory("beneficios")).toBe("Benefícios");
  });

  it("e' case-insensitive na chave", () => {
    expect(formatAnnouncementCategory("RH")).toBe("RH");
    expect(formatAnnouncementCategory("Seguranca")).toBe("Segurança");
  });

  it("categoria fora do mapa (texto livre do admin) cai no fallback de capitalização, nunca mostra o valor cru", () => {
    expect(formatAnnouncementCategory("marketing")).toBe("Marketing");
    expect(formatAnnouncementCategory("ti")).toBe("Ti");
  });

  it("string vazia devolve vazio sem lançar", () => {
    expect(formatAnnouncementCategory("")).toBe("");
    expect(formatAnnouncementCategory("   ")).toBe("");
  });
});
