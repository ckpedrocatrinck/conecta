import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveBeneficiosBannerSrc, resolveVagasBannerSrc } from "./section-banner-display";

// Mesmo padrao de branding-display.test.ts: usa a LocalMediaStorage real (sem
// mock de modulo), so' estubando AUTH_SECRET (getViewUrl assina com ele).

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveVagasBannerSrc (INC-019: Vagas tem arte fixa)", () => {
  it("sem key => fallback fixo /banners/vagas.png", async () => {
    expect(await resolveVagasBannerSrc(null)).toBe("/banners/vagas.png");
  });

  it("com key => URL assinada de view", async () => {
    vi.stubEnv("AUTH_SECRET", "segredo-teste");
    const src = await resolveVagasBannerSrc("branding/t/vagas-banner/x");
    expect(src).toContain("/api/media/");
    expect(src).toContain("mode=view");
  });
});

describe("resolveBeneficiosBannerSrc (INC-019: Beneficios NAO tem arte fixa)", () => {
  it("sem key => undefined (HomeBanner cai no modo texto, nao numa imagem generica)", async () => {
    expect(await resolveBeneficiosBannerSrc(null)).toBeUndefined();
  });

  it("com key => URL assinada de view", async () => {
    vi.stubEnv("AUTH_SECRET", "segredo-teste");
    const src = await resolveBeneficiosBannerSrc("branding/t/beneficios-banner/x");
    expect(src).toContain("/api/media/");
    expect(src).toContain("mode=view");
  });
});
