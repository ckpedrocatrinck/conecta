import type { MediaStorage } from "./media-storage";
import { maxBytesForContentType, type AllowedContentType, type PostMediaKind } from "./media-constraints";
import { sniffMediaType, SNIFF_HEADER_BYTES } from "./media-sniff";

// Autoridade sobre o anexo enviado (INC-016). Como o upload vai DIRETO do
// navegador ao storage (presigned — necessario pelo limite de 4,5MB de payload
// de funcao serverless da Vercel), a validacao de tipo/tamanho nao acontece no
// caminho do byte; acontece AQUI, depois, lendo so' o cabeçalho do objeto ja'
// gravado. Objeto reprovado e' APAGADO do storage (nao fica orfao valido nem
// visivel: so' vira anexo quem cria linha em PostMedia, o que so' ocorre no ok).

export type UploadRejectReason = "not_found" | "type" | "size";

export type UploadValidation =
  | { ok: true; kind: PostMediaKind; contentType: AllowedContentType; sizeBytes: number }
  | { ok: false; reason: UploadRejectReason };

const REJECT_MESSAGE: Record<UploadRejectReason, string> = {
  not_found: "Upload não encontrado. Tente enviar novamente.",
  // Um arquivo vazio ou de conteudo irreconhecivel cai aqui (o sniff nao casa
  // nenhuma assinatura): mensagem unica de tipo nao permitido.
  type: "Tipo de arquivo não permitido. Aceitamos JPG, PNG, WEBP ou PDF.",
  size: "Arquivo acima do tamanho máximo (imagem 5 MB, PDF 10 MB).",
};

export function uploadRejectMessage(reason: UploadRejectReason): string {
  return REJECT_MESSAGE[reason];
}

/**
 * Le o cabeçalho do objeto no storage, detecta o tipo REAL por magic number e
 * confere o tamanho real. Em qualquer reprova, APAGA o objeto e retorna o
 * motivo. O tipo devolvido vem do sniff — nunca do que o cliente declarou.
 */
export async function validateUploadedObject(storage: MediaStorage, key: string): Promise<UploadValidation> {
  const head = await storage.readHead(key, SNIFF_HEADER_BYTES);
  if (!head) return { ok: false, reason: "not_found" };

  const sniff = sniffMediaType(head.bytes);
  if (!sniff) {
    await storage.delete(key);
    return { ok: false, reason: "type" };
  }

  const limit = maxBytesForContentType(sniff.contentType);
  // limit nunca e' null aqui (sniff so' devolve tipos aceitos), mas o guard
  // mantem o tipo estreito sem `!`.
  if (limit === null || head.totalSize > limit) {
    await storage.delete(key);
    return { ok: false, reason: "size" };
  }

  return { ok: true, kind: sniff.kind, contentType: sniff.contentType, sizeBytes: head.totalSize };
}
