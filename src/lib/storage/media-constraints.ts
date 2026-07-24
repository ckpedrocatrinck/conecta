// Compartilhado entre a rota /api/media/[key] (validacao server-side), o passo
// de confirmacao de upload (autoridade sobre o tipo real, via magic number —
// ver media-sniff.ts) e os componentes client de upload (validacao antecipada
// antes de enviar). O conjunto e' a lista canonica de tipos aceitos como anexo
// de post (INC-016): imagem (jpg/png/webp) + documento (pdf).

export const ALLOWED_IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_DOCUMENT_CONTENT_TYPES = ["application/pdf"] as const;

export type AllowedImageContentType = (typeof ALLOWED_IMAGE_CONTENT_TYPES)[number];
export type AllowedDocumentContentType = (typeof ALLOWED_DOCUMENT_CONTENT_TYPES)[number];
export type AllowedContentType = AllowedImageContentType | AllowedDocumentContentType;

// Set unico para checagem rapida (mantem o nome historico usado pela rota).
export const ALLOWED_MEDIA_CONTENT_TYPES = new Set<string>([
  ...ALLOWED_IMAGE_CONTENT_TYPES,
  ...ALLOWED_DOCUMENT_CONTENT_TYPES,
]);

// Limites por classe. Imagem continua em 5MB (INC-003). PDF vai a 10MB: um
// documento escaneado multi-pagina passa de 5MB com facilidade, e 10MB ainda
// limita o uso de memoria no processamento. O maior dos dois e' o teto absoluto
// usado como guarda grosseira no caminho de upload (a autoridade fina por tipo
// e' `maxBytesForContentType`, aplicada no confirm sobre o tamanho REAL do
// objeto ja' no storage).
export const MAX_MEDIA_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_ANY_UPLOAD_BYTES = Math.max(MAX_MEDIA_UPLOAD_BYTES, MAX_PDF_UPLOAD_BYTES);

// Teto de anexos por post (imagem + documento somados). Mantem a UX de upload
// do INC-008 (ate 5 fotos); o servidor e' a autoridade sobre o teto (o cliente
// tambem valida para feedback antecipado).
export const MAX_POST_ATTACHMENTS = 5;

export type PostMediaKind = "image" | "document";

/** Classe (image|document) de um content-type aceito, ou null se nao aceito. */
export function kindForContentType(contentType: string): PostMediaKind | null {
  if ((ALLOWED_IMAGE_CONTENT_TYPES as readonly string[]).includes(contentType)) return "image";
  if ((ALLOWED_DOCUMENT_CONTENT_TYPES as readonly string[]).includes(contentType)) return "document";
  return null;
}

/** Limite de bytes para um content-type aceito, ou null se nao aceito. */
export function maxBytesForContentType(contentType: string): number | null {
  const kind = kindForContentType(contentType);
  if (kind === "image") return MAX_MEDIA_UPLOAD_BYTES;
  if (kind === "document") return MAX_PDF_UPLOAD_BYTES;
  return null;
}
