import { NextRequest, NextResponse } from "next/server";
import { getActiveSession, type ActiveSession } from "../../../../lib/auth/session";
import { verifyMediaToken } from "../../../../lib/storage/media-storage";
import { readMediaFile, writeMediaFile } from "../../../../lib/storage/local-media-fs";
import {
  ALLOWED_IMAGE_CONTENT_TYPES,
  ALLOWED_MEDIA_CONTENT_TYPES,
  MAX_ANY_UPLOAD_BYTES,
} from "../../../../lib/storage/media-constraints";

/**
 * Autorizacao por namespace de chave — cada prefixo tem sua propria regra de
 * quem pode ler/escrever:
 * - `avatars/{tenantId}/{userId}`: so' o proprio dono, ver/enviar (INC-003).
 * - `posts/{tenantId}/{postId}/...`: ver e' liberado para qualquer sessao
 *   ativa do tenant (colaborador precisa ver a foto no feed); enviar so'
 *   para admin do mesmo tenant (INC-008).
 */
function authorizeMediaKey(key: string, mode: "view" | "upload", session: ActiveSession): boolean {
  const avatarMatch = key.match(/^avatars\/([^/]+)\/([^/]+)$/);
  if (avatarMatch) {
    const [, tenantId, userId] = avatarMatch;
    return tenantId === session.tenantId && userId === session.userId;
  }

  const postMediaMatch = key.match(/^posts\/([^/]+)\/([^/]+)\/[^/]+$/);
  if (postMediaMatch) {
    const [, tenantId] = postMediaMatch;
    if (tenantId !== session.tenantId) return false;
    return mode === "view" || session.role === "admin";
  }

  return false;
}

export async function GET(request: NextRequest, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  const decodedKey = decodeURIComponent(key);

  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!authorizeMediaKey(decodedKey, "view", session)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const token = searchParams.get("token") ?? "";
  const expiresAt = Number(searchParams.get("exp"));
  if (!verifyMediaToken(decodedKey, "view", expiresAt, token)) {
    return NextResponse.json({ error: "link expirado ou inválido" }, { status: 403 });
  }

  const file = await readMediaFile(decodedKey);
  if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(file.data), {
    headers: { "Content-Type": file.contentType, "Cache-Control": "private, max-age=60" },
  });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  const decodedKey = decodeURIComponent(key);

  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!authorizeMediaKey(decodedKey, "upload", session)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const token = searchParams.get("token") ?? "";
  const expiresAt = Number(searchParams.get("exp"));
  if (!verifyMediaToken(decodedKey, "upload", expiresAt, token)) {
    return NextResponse.json({ error: "link expirado ou inválido" }, { status: 403 });
  }

  // Este PUT so' existe no caminho DEV (o mock aponta a URL assinada de upload
  // para ca'). Em producao o presigned aponta direto ao R2 e este handler nao
  // roda. As checagens aqui sao guardas grosseiras (content-type na lista,
  // tamanho ate o teto absoluto) — a AUTORIDADE sobre o tipo REAL e o tamanho
  // por classe e' o confirm (validateUploadedObject), que le o objeto gravado.
  // Avatar (INC-003) so' aceita imagem — nao ha etapa de confirm que revalide a
  // foto de perfil, entao a guarda por namespace continua sendo a linha de
  // defesa aqui. Anexo de post (posts/) aceita imagem + PDF; o tipo REAL desses
  // e' reconferido no confirm (validateUploadedObject).
  const contentType = request.headers.get("content-type") ?? "";
  const allowedForKey = decodedKey.startsWith("avatars/")
    ? (ALLOWED_IMAGE_CONTENT_TYPES as readonly string[])
    : [...ALLOWED_MEDIA_CONTENT_TYPES];
  if (!allowedForKey.includes(contentType)) {
    return NextResponse.json({ error: "tipo de arquivo não permitido" }, { status: 415 });
  }

  const body = Buffer.from(await request.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > MAX_ANY_UPLOAD_BYTES) {
    return NextResponse.json({ error: "tamanho de arquivo inválido" }, { status: 413 });
  }

  await writeMediaFile(decodedKey, body, contentType);
  return NextResponse.json({ ok: true });
}
