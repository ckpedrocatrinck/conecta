// Compartilhado entre a rota /api/media/[key] (validacao server-side) e os
// componentes client de upload (validacao antecipada antes de enviar).
export const ALLOWED_MEDIA_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_MEDIA_UPLOAD_BYTES = 5 * 1024 * 1024;
