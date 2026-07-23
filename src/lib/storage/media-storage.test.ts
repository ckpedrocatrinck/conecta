import { afterEach, describe, expect, it, vi } from "vitest";
import { mediaStorage, verifyMediaToken } from "./media-storage";

// Gera um token real pelo mesmo caminho que a app usa (getViewUrl) e extrai os
// parametros da URL assinada.
function parseSignedUrl(url: string): { mode: "view" | "upload"; exp: number; token: string } {
  const q = new URL(url, "http://local").searchParams;
  return { mode: q.get("mode") as "view" | "upload", exp: Number(q.get("exp")), token: q.get("token") ?? "" };
}

describe("token de midia: assinatura e verificacao (INC-013 G11)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("um token recem-gerado verifica", async () => {
    vi.stubEnv("AUTH_SECRET", "segredo-teste");
    const key = "avatars/tenant-1/user-1";
    const { mode, exp, token } = parseSignedUrl(await mediaStorage.getViewUrl(key));
    expect(verifyMediaToken(key, mode, exp, token)).toBe(true);
  });

  it("key, mode ou exp adulterados NAO verificam", async () => {
    vi.stubEnv("AUTH_SECRET", "segredo-teste");
    const key = "avatars/tenant-1/user-1";
    const { mode, exp, token } = parseSignedUrl(await mediaStorage.getViewUrl(key));
    expect(verifyMediaToken("avatars/tenant-1/OUTRO", mode, exp, token)).toBe(false);
    expect(verifyMediaToken(key, "upload", exp, token)).toBe(false);
    expect(verifyMediaToken(key, mode, exp + 1, token)).toBe(false);
  });

  it("token expirado NAO verifica (a expiracao e' checada antes da assinatura)", () => {
    vi.stubEnv("AUTH_SECRET", "segredo-teste");
    expect(verifyMediaToken("k", "view", Date.now() - 1000, "qualquer-coisa")).toBe(false);
  });

  it("token de tamanho diferente NAO verifica e NAO lanca (guarda antes do timingSafeEqual)", async () => {
    vi.stubEnv("AUTH_SECRET", "segredo-teste");
    const key = "avatars/tenant-1/user-1";
    const { mode, exp } = parseSignedUrl(await mediaStorage.getViewUrl(key));
    expect(verifyMediaToken(key, mode, exp, "curto")).toBe(false);
  });

  it("token assinado com outro AUTH_SECRET NAO verifica", async () => {
    vi.stubEnv("AUTH_SECRET", "segredo-A");
    const key = "avatars/tenant-1/user-1";
    const { mode, exp, token } = parseSignedUrl(await mediaStorage.getViewUrl(key));
    vi.stubEnv("AUTH_SECRET", "segredo-B");
    expect(verifyMediaToken(key, mode, exp, token)).toBe(false);
  });
});
