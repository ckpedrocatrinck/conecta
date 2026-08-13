import { describe, expect, it } from "vitest";
import { HOME_BANNER_IMAGE_CLASSNAME } from "./home-banner";

// Sem infra de render de componente neste projeto (vitest roda em
// `environment: "node"`, sem jsdom/testing-library) — trava a proporção do
// banner na string de classes, não no DOM renderizado (INC-027 Bloco 3.6:
// container com altura fixa (max-h-52) + w-full ficava muito mais largo que
// 16:9 em qualquer tela >~370px, e object-cover cortava topo/base de uma arte
// corretamente 1920×1080).
describe("HOME_BANNER_IMAGE_CLASSNAME (INC-027 Bloco 3.6)", () => {
  it("usa aspect-video (16:9) — casa com o 'Tamanho recomendado' da tela de Aparência", () => {
    expect(HOME_BANNER_IMAGE_CLASSNAME).toContain("aspect-video");
  });

  it("não volta a usar altura fixa (max-h-*), que quebrava a proporção em telas largas", () => {
    expect(HOME_BANNER_IMAGE_CLASSNAME).not.toMatch(/\bmax-h-\d/);
  });

  it("mantém object-cover (a arte preenche o container, sem barras vazias)", () => {
    expect(HOME_BANNER_IMAGE_CLASSNAME).toContain("object-cover");
  });

  it("tem um teto de largura, para não virar gigante em telas sem max-width própria (ex.: dashboard admin)", () => {
    expect(HOME_BANNER_IMAGE_CLASSNAME).toMatch(/\bmax-w-\S+/);
  });
});
