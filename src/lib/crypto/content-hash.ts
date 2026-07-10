import { createHash } from "node:crypto";

/**
 * Hash do conteudo de uma versao de comunicado — evidencia de qual texto
 * exato foi lido/confirmado (ADR-001). Recalculado a cada nova versao.
 */
export function computeContentHash(title: string, body: string): string {
  return createHash("sha256").update(`${title}\n${body}`).digest("hex");
}
