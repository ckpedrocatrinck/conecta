import { describe, expect, it } from "vitest";
import { birthdayWindowMonthDays } from "./birthday-window";

describe("birthdayWindowMonthDays — virada de dia respeita America/Sao_Paulo, nao UTC", () => {
  it("as 01:30 UTC de um dia, o 'hoje' em SP ainda e' o dia anterior (UTC-3)", () => {
    // 2026-07-14T01:30:00Z = 2026-07-13T22:30:00-03:00 em SP.
    const now = new Date("2026-07-14T01:30:00Z");
    const [today] = birthdayWindowMonthDays(now, 0);
    expect(today).toEqual({ month: 7, day: 13 });
  });

  it("as 12:00 UTC (meio da tarde em SP), 'hoje' coincide em ambos os fusos", () => {
    const now = new Date("2026-07-14T12:00:00Z");
    const [today] = birthdayWindowMonthDays(now, 0);
    expect(today).toEqual({ month: 7, day: 14 });
  });

  it("janela de 7 dias tem 8 pares (hoje + 7), avancando um dia por vez", () => {
    const now = new Date("2026-07-14T12:00:00Z");
    const window = birthdayWindowMonthDays(now, 7);
    expect(window).toHaveLength(8);
    expect(window[0]).toEqual({ month: 7, day: 14 });
    expect(window[7]).toEqual({ month: 7, day: 21 });
  });

  it("vira o ano corretamente (dez -> jan) sem tratamento especial no chamador", () => {
    const now = new Date("2026-12-29T12:00:00Z");
    const window = birthdayWindowMonthDays(now, 7);
    expect(window).toEqual([
      { month: 12, day: 29 },
      { month: 12, day: 30 },
      { month: 12, day: 31 },
      { month: 1, day: 1 },
      { month: 1, day: 2 },
      { month: 1, day: 3 },
      { month: 1, day: 4 },
      { month: 1, day: 5 },
    ]);
  });
});
