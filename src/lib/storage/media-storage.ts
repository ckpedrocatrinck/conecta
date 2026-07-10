import { createHmac, timingSafeEqual } from "node:crypto";

// Contrato de acesso restrito a midia (fotos de perfil): a key do objeto e'
// o que fica gravado no banco (User.photoUrl), NUNCA uma URL publica. Tanto
// o mock local (INC-003) quanto o R2 real (INC futuro) implementam esta
// mesma interface — trocar um pelo outro nao deve exigir mudar nada fora
// deste arquivo e da rota /api/media/[key].
export interface MediaStorage {
  getUploadUrl(key: string): Promise<string>;
  getViewUrl(key: string): Promise<string>;
}

const SIGNED_URL_TTL_MS = 5 * 60 * 1000;

function signingSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET nao configurado — necessario para assinar URLs de midia");
  return secret;
}

function sign(key: string, mode: "view" | "upload", expiresAt: number): string {
  return createHmac("sha256", signingSecret()).update(`${mode}:${key}:${expiresAt}`).digest("hex");
}

/** Verifica assinatura + expiracao de uma URL de midia (usado pela rota
 * /api/media/[key]). Nao substitui a checagem de sessao — so' garante que o
 * link nao foi forjado nem reusado depois do TTL curto. */
export function verifyMediaToken(key: string, mode: "view" | "upload", expiresAt: number, token: string): boolean {
  if (Number.isNaN(expiresAt) || expiresAt < Date.now()) return false;
  const expected = sign(key, mode, expiresAt);
  const expectedBuf = Buffer.from(expected);
  const tokenBuf = Buffer.from(token);
  return expectedBuf.length === tokenBuf.length && timingSafeEqual(expectedBuf, tokenBuf);
}

class LocalMediaStorage implements MediaStorage {
  private buildUrl(key: string, mode: "view" | "upload"): string {
    const expiresAt = Date.now() + SIGNED_URL_TTL_MS;
    const token = sign(key, mode, expiresAt);
    const params = new URLSearchParams({ mode, exp: String(expiresAt), token });
    return `/api/media/${encodeURIComponent(key)}?${params.toString()}`;
  }

  async getUploadUrl(key: string): Promise<string> {
    return this.buildUrl(key, "upload");
  }

  async getViewUrl(key: string): Promise<string> {
    return this.buildUrl(key, "view");
  }
}

// Dívida técnica deliberada (aprovada por Pedro): storage real (R2/S3) fica
// para um INC futuro. Trocar aqui por uma implementacao com
// @aws-sdk/client-s3 + s3-request-presigner nao deve exigir mudar nenhum
// chamador — todos dependem so' da interface MediaStorage.
export const mediaStorage: MediaStorage = new LocalMediaStorage();
