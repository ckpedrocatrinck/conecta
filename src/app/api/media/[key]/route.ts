import { NextRequest, NextResponse } from "next/server";
import { getActiveSession } from "../../../../lib/auth/session";
import { verifyMediaToken } from "../../../../lib/storage/media-storage";
import { readMediaFile, writeMediaFile } from "../../../../lib/storage/local-media-fs";

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function ownsKey(key: string, tenantId: string, userId: string): boolean {
  return key === `avatars/${tenantId}/${userId}`;
}

export async function GET(request: NextRequest, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  const decodedKey = decodeURIComponent(key);

  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!ownsKey(decodedKey, session.tenantId, session.userId)) {
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
  if (!ownsKey(decodedKey, session.tenantId, session.userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const token = searchParams.get("token") ?? "";
  const expiresAt = Number(searchParams.get("exp"));
  if (!verifyMediaToken(decodedKey, "upload", expiresAt, token)) {
    return NextResponse.json({ error: "link expirado ou inválido" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json({ error: "tipo de arquivo não permitido" }, { status: 415 });
  }

  const body = Buffer.from(await request.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "tamanho de arquivo inválido" }, { status: 413 });
  }

  await writeMediaFile(decodedKey, body, contentType);
  return NextResponse.json({ ok: true });
}
