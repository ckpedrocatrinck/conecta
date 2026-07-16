import { describe, expect, it } from "vitest";
import { getSaoPauloYear, toDatetimeLocalSaoPaulo } from "./format-datetime";

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

describe("toDatetimeLocalSaoPaulo — pre-preenche datetime-local em horario de SP, nao UTC (R23)", () => {
  it("18:00 UTC (15:00 em SP) aparece como 15:00 no input, nao 18:00", () => {
    const date = new Date("2026-07-20T18:00:00Z");
    expect(toDatetimeLocalSaoPaulo(date)).toBe("2026-07-20T15:00");
  });

  it("na virada de ano, a data em SP fica no dia anterior mesmo com UTC ja no ano seguinte", () => {
    const date = new Date("2027-01-01T01:30:00Z");
    expect(toDatetimeLocalSaoPaulo(date)).toBe("2026-12-31T22:30");
  });
});
