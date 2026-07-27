import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inlineBrandingLogoForExport, signBrandingForDisplay } from "./branding-display";
import { deleteMediaFile, writeMediaFile } from "@/lib/storage/local-media-fs";

// Assinatura PNG (8 bytes) — o sniff decide o tipo so' pelo cabecalho (ver
// media-sniff). Basta comecar com ela para o objeto ser reconhecido como PNG.
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03]);

const writtenKeys: string[] = [];
async function writeLogo(): Promise<string> {
  const key = `branding/${randomUUID()}/logo/${randomUUID()}`;
  await writeMediaFile(key, PNG_BYTES, "image/png");
  writtenKeys.push(key);
  return key;
}

afterEach(async () => {
  await Promise.all(writtenKeys.splice(0).map((k) => deleteMediaFile(k)));
  vi.unstubAllEnvs();
});

describe("inlineBrandingLogoForExport (INC-017: logo no PNG exportavel)", () => {
  it("embute o logo como data URI (satori nao tem cookie para /api/media)", async () => {
    const key = await writeLogo();
    const result = await inlineBrandingLogoForExport({ logoUrl: key, accentColor: "#111111" });

    expect(result.logoUrl).toMatch(/^data:image\/png;base64,/);
    // o base64 decodifica de volta para os bytes do objeto
    const b64 = result.logoUrl!.split(",")[1];
    expect(Buffer.from(b64, "base64").equals(PNG_BYTES)).toBe(true);
    // accentColor passa direto
    expect(result.accentColor).toBe("#111111");
  });

  it("sem logo => devolve branding intacto (logoUrl null)", async () => {
    const result = await inlineBrandingLogoForExport({ logoUrl: null, accentColor: "#222222" });
    expect(result.logoUrl).toBeNull();
  });

  it("objeto inexistente => logoUrl null (card so' omite o logo, nunca quebra)", async () => {
    const result = await inlineBrandingLogoForExport({
      logoUrl: `branding/${randomUUID()}/logo/${randomUUID()}`,
      accentColor: null,
    });
    expect(result.logoUrl).toBeNull();
  });
});

describe("signBrandingForDisplay (INC-017: logo no browser)", () => {
  it("assina a key numa URL /api/media de view; null continua null", async () => {
    // getViewUrl assina com AUTH_SECRET (media-storage). No CI o .env nao e'
    // carregado no job de unit, entao stubamos como o media-storage.test.ts.
    vi.stubEnv("AUTH_SECRET", "segredo-teste");
    const signed = await signBrandingForDisplay({ logoUrl: "branding/t/logo/x", accentColor: "#333333" });
    expect(signed.logoUrl).toContain("/api/media/");
    expect(signed.logoUrl).toContain("mode=view");
    expect(signed.accentColor).toBe("#333333");

    const empty = await signBrandingForDisplay({ logoUrl: null, accentColor: null });
    expect(empty.logoUrl).toBeNull();
  });
});
