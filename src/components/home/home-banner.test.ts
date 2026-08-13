import { describe, expect, it } from "vitest";
import { HOME_BANNER_IMAGE_CLASSNAME } from "./home-banner";

// Sem infra de render de componente neste projeto (vitest roda em
// `environment: "node"`, sem jsdom/testing-library) — trava a proporção do
// banner na string de classes, não no DOM renderizado.
//
// Este é o TERCEIRO ciclo neste componente (INC-027 Blocos 3.6 → 3.8):
// 3.6 forçou aspect-video (16:9) sem medir as artes reais (container ficou
// maior que o necessário, sobrando fundo da própria arte — lido como faixa
// vazia); a primeira correção do 3.8 mediu as 3 artes e trocou para
// aspect-[2/1] (aproximação da média medida); o Pedro então definiu
// 1920×650px (≈2,954:1) como o padrão OFICIAL do produto — diferente das
// duas tentativas anteriores. `aspect-[1920/650]` é o valor exato.
describe("HOME_BANNER_IMAGE_CLASSNAME (INC-027 Bloco 3.8 — padrão 1920×650)", () => {
  it("usa aspect-[1920/650] (≈2,954:1), o padrão oficial definido pelo Pedro", () => {
    expect(HOME_BANNER_IMAGE_CLASSNAME).toContain("aspect-[1920/650]");
    expect(HOME_BANNER_IMAGE_CLASSNAME).not.toContain("aspect-video");
    expect(HOME_BANNER_IMAGE_CLASSNAME).not.toContain("aspect-[2/1]");
  });

  it("mantém object-cover (a arte preenche o container, sem barras vazias)", () => {
    expect(HOME_BANNER_IMAGE_CLASSNAME).toContain("object-cover");
  });

  it("tem um teto de largura, para não virar gigante em telas sem max-width própria (ex.: dashboard admin)", () => {
    expect(HOME_BANNER_IMAGE_CLASSNAME).toMatch(/\bmax-w-\S+/);
  });

  it("tem um teto de ALTURA como segurança contra dominar a página em containers muito largos", () => {
    expect(HOME_BANNER_IMAGE_CLASSNAME).toContain("max-h-60");
  });

  it("altura calculada em 3 larguras (incl. mobile) fica contida — aspect-ratio governa, o teto é só backstop", () => {
    const ASPECT_RATIO = 1920 / 650; // extraído de aspect-[1920/650]
    const MAX_HEIGHT_PX = 240; // max-h-60 = 15rem = 240px

    const widths = { mobile: 360, tablet: 512, desktopColumn: 672 };
    const heights = Object.fromEntries(
      Object.entries(widths).map(([k, w]) => [k, Math.min(w / ASPECT_RATIO, MAX_HEIGHT_PX)]),
    );

    expect(heights.mobile).toBeCloseTo(121.9, 0);
    expect(heights.tablet).toBeCloseTo(173.3, 0);
    expect(heights.desktopColumn).toBeCloseTo(227.5, 0); // abaixo do teto de 240 — não chega a clampar

    // Em nenhuma das 3 larguras a altura deveria dominar (> 1/3 de um
    // viewport mobile comum de 700px de altura útil) — a proporção 1920×650
    // é deliberadamente mais "faixa" que os dois ciclos anteriores.
    for (const h of Object.values(heights)) {
      expect(h).toBeLessThan(700 / 3);
    }
  });
});
