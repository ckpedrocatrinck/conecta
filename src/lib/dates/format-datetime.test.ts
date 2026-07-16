import { describe, expect, it } from "vitest";
import { getSaoPauloYear } from "./format-datetime";

describe("getSaoPauloYear — ano do CI NN/AAAA em America/Sao_Paulo, nao UTC (A4-4)", () => {
  it("na virada de ano, com UTC ja em Janeiro mas BRT ainda em 31/dez, usa o ano ANTERIOR", () => {
    // 2027-01-01T01:30:00Z (UTC = 2027) = 2026-12-31T22:30:00-03:00 em SP (ainda 2026).
    const now = new Date("2027-01-01T01:30:00Z");
    expect(getSaoPauloYear(now)).toBe(2026);
    expect(now.getUTCFullYear()).toBe(2027); // confirma que o bug (UTC cru) reproduziria 2027
  });

  it("fora da janela de virada, ano em SP coincide com UTC", () => {
    const now = new Date("2026-07-14T12:00:00Z");
    expect(getSaoPauloYear(now)).toBe(2026);
  });
});
