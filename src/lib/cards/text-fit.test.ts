import { describe, expect, it } from "vitest";
import { cardTitleFontSize, personNameFontSize } from "./text-fit";

describe("personNameFontSize — critério de aceite: nome de 40+ caracteres não quebra o card", () => {
  it("reduz o tamanho de fonte para nome com 40+ caracteres, sem truncar o texto em si", () => {
    const longName = "Maria Aparecida dos Santos Oliveira Nascimento"; // 47 chars
    expect(longName.length).toBeGreaterThanOrEqual(40);

    const size = personNameFontSize(longName);
    expect(size).toBeLessThan(personNameFontSize("Ana Silva"));
    expect(size).toBeGreaterThan(0);
  });

  it("mantém o tamanho base para nome curto", () => {
    expect(personNameFontSize("Ana Silva")).toBe(20);
  });
});

describe("cardTitleFontSize", () => {
  it("reduz o tamanho de fonte para título com 40+ caracteres", () => {
    const longTitle = "Reconhecimento pelo excelente trabalho realizado neste trimestre inteiro";
    expect(longTitle.length).toBeGreaterThanOrEqual(40);
    expect(cardTitleFontSize(longTitle)).toBeLessThan(cardTitleFontSize("Parabéns!"));
  });
});
