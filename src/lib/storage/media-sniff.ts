import type { AllowedContentType, PostMediaKind } from "./media-constraints";

// Deteccao de tipo REAL por magic number (INC-016). NUNCA confiar na extensao
// nem no content-type declarado pelo cliente: um "documento.pdf" pode ser um
// executavel disfarcado. O confirm de upload le so' o cabeçalho do objeto ja'
// no storage (primeiros bytes) e passa aqui — o tipo gravado em PostMedia vem
// DESTE resultado, nao do que o navegador afirmou.
//
// Precisamos de no minimo 12 bytes para distinguir WEBP (checa offset 8..11);
// o confirm le 16 por folga.
export const SNIFF_HEADER_BYTES = 16;

export type SniffResult = { kind: PostMediaKind; contentType: AllowedContentType };

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Retorna o tipo real do arquivo a partir dos primeiros bytes, ou null se nao
 * for um dos tipos aceitos (jpg/png/webp/pdf). Assinaturas:
 * - JPEG: FF D8 FF
 * - PNG:  89 50 4E 47 0D 0A 1A 0A
 * - WEBP: "RIFF" (52 49 46 46) em 0..3 e "WEBP" (57 45 42 50) em 8..11
 * - PDF:  "%PDF-" (25 50 44 46 2D)
 */
export function sniffMediaType(header: Uint8Array): SniffResult | null {
  if (startsWith(header, [0xff, 0xd8, 0xff])) {
    return { kind: "image", contentType: "image/jpeg" };
  }
  if (startsWith(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: "image", contentType: "image/png" };
  }
  if (startsWith(header, [0x52, 0x49, 0x46, 0x46]) && startsWith(header, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { kind: "image", contentType: "image/webp" };
  }
  if (startsWith(header, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { kind: "document", contentType: "application/pdf" };
  }
  return null;
}
