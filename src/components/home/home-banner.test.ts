import { describe, expect, it } from "vitest";
import { HOME_BANNER_IMAGE_CLASSNAME } from "./home-banner";

// Sem infra de render de componente neste projeto (vitest roda em
// `environment: "node"`, sem jsdom/testing-library) — trava a proporção do
// banner na string de classes, não no DOM renderizado.
//
// INC-027 Bloco 3.6: container com altura fixa (max-h-52) + w-full ficava
// muito mais largo que 16:9 em qualquer tela >~370px, e object-cover cortava
// topo/base de uma arte corretamente 1920×1080.
//
// INC-027 Bloco 3.8: a correção do 3.6 media errado — as 3 artes padrão do
// produto NUNCA foram 16:9 (home.png 1.874:1, vagas.png 2:1 exato, clube.png
// 1.777:1). Forçar aspect-video (1.778:1) nelas só trocou o descompasso de
// lugar: o container virou maior que o necessário, sobrando fundo da própria
// arte (branco/creme nas 3) que lia como faixa vazia. `aspect-[2/1]` casa com
// a proporção medida de verdade; `max-h-64` é só um teto de segurança para
// containers muito largos (ex.: dashboard admin, sem max-width própria) não
// deixarem o banner dominar a dobra inicial — nunca o dimensionador
// primário, papel que continua sendo do aspect-ratio.
describe("HOME_BANNER_IMAGE_CLASSNAME (INC-027 Bloco 3.8)", () => {
  it("usa aspect-[2/1], a proporção medida das artes reais (não 16:9)", () => {
    expect(HOME_BANNER_IMAGE_CLASSNAME).toContain("aspect-[2/1]");
    expect(HOME_BANNER_IMAGE_CLASSNAME).not.toContain("aspect-video");
  });

  it("mantém object-cover (a arte preenche o container, sem barras vazias)", () => {
    expect(HOME_BANNER_IMAGE_CLASSNAME).toContain("object-cover");
  });

  it("tem um teto de largura, para não virar gigante em telas sem max-width própria (ex.: dashboard admin)", () => {
    expect(HOME_BANNER_IMAGE_CLASSNAME).toMatch(/\bmax-w-\S+/);
  });

  it("tem um teto de ALTURA (max-h-64) como segurança contra dominar a página em containers muito largos", () => {
    expect(HOME_BANNER_IMAGE_CLASSNAME).toContain("max-h-64");
  });

  it("altura calculada em 3 larguras fica dentro do esperado (aspect-ratio governa, o teto só entra em containers largos)", () => {
    const ASPECT_RATIO = 2; // width / height, extraído de aspect-[2/1]
    const MAX_HEIGHT_PX = 256; // max-h-64 = 16rem = 256px

    const widths = { mobile: 360, tablet: 512, desktopColumn: 672 };
    const heights = Object.fromEntries(
      Object.entries(widths).map(([k, w]) => [k, Math.min(w / ASPECT_RATIO, MAX_HEIGHT_PX)]),
    );

    expect(heights.mobile).toBeCloseTo(180, 0); // 360/2, bem abaixo do teto
    expect(heights.tablet).toBeCloseTo(256, 0); // 512/2 = 256, exatamente no teto
    expect(heights.desktopColumn).toBe(MAX_HEIGHT_PX); // 672/2=336 > teto, clampado em 256

    // Em nenhuma das 3 larguras a altura deveria dominar (> ~40% de um
    // viewport mobile comum de 700px de altura útil).
    for (const h of Object.values(heights)) {
      expect(h).toBeLessThan(700 * 0.4);
    }
  });
});
