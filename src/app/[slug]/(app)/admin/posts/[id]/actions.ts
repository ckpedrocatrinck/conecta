"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import type { PostType } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import {
  addPostMedia,
  countPostMedia,
  findPostById,
  findPostMediaById,
  publishPost,
  removePostMedia,
  replacePostPeople,
  updatePostFields,
} from "@/lib/repositories/post.repository";
import { recordAuditLog } from "@/lib/repositories/audit-log.repository";
import { mediaStorage } from "@/lib/storage/media-storage";
import {
  MAX_POST_ATTACHMENTS,
  kindForContentType,
  maxBytesForContentType,
} from "@/lib/storage/media-constraints";
import { uploadRejectMessage, validateUploadedObject } from "@/lib/storage/validate-upload";

const VALID_TYPES = new Set<PostType>(["recognition", "tenure", "promotion", "general"]);

/**
 * Salva os campos do post e, se `intent=publish`, publica na MESMA operacao —
 * um form, dois botoes de submit ("Salvar" / "Publicar", ver EditPostForm). O
 * titulo validado aqui vem do FORMULARIO (nao do banco), entao "digitar titulo
 * e clicar Publicar" funciona sem precisar salvar antes. O guard do
 * auto-rascunho (INC-016) e' o proprio `!title`: rascunho vazio nao publica.
 */
export async function updatePostAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const type = String(formData.get("type") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const eventDateRaw = String(formData.get("eventDate") ?? "");
  const branchId = String(formData.get("branchId") ?? "").trim();
  const personIds = formData.getAll("personIds").map(String);
  const publish = String(formData.get("intent") ?? "save") === "publish";

  const eventDate = eventDateRaw ? new Date(eventDateRaw) : null;

  if (!id || !VALID_TYPES.has(type as PostType) || !title || !eventDate || Number.isNaN(eventDate.getTime())) {
    redirect(`/${session.tenantSlug}/admin/posts/${id}?erro=obrigatorio`);
  }

  await withTenant({ tenantId: session.tenantId }, async (tx) => {
    await updatePostFields(tx, session.tenantId, id, {
      type: type as PostType,
      title,
      body: body || null,
      eventDate: eventDate as Date,
      branchId: branchId || null,
    });

    await replacePostPeople(
      tx,
      session.tenantId,
      id,
      personIds.map((userId) => ({ userId })),
    );

    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "post.update",
      entity: "Post",
      entityId: id,
    });

    if (publish) {
      await publishPost(tx, session.tenantId, id);
      await recordAuditLog(tx, {
        tenantId: session.tenantId,
        actorUserId: session.userId,
        action: "post.publish",
        entity: "Post",
        entityId: id,
      });
    }
  });

  redirect(`/${session.tenantSlug}/admin/posts/${id}?${publish ? "ok=publicado" : "salvo=ok"}`);
}

function postMediaKey(tenantId: string, postId: string): string {
  return `posts/${tenantId}/${postId}/${randomUUID()}`;
}

/** Nome exibido do anexo — nao e' de confianca (vem do cliente). So' rotulo:
 * remove diretorio, controla comprimento e caracteres de controle. A seguranca
 * de exibicao e' a escapagem do React + o `download` do anchor. */
function sanitizeOriginalName(raw: string): string {
  const base = raw.split(/[/\\]/).pop() ?? raw;
  // Remove ASCII de controle (0x00-0x1F, 0x7F) sem regex literal de controle.
  const cleaned = Array.from(base)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code > 0x1f && code !== 0x7f;
    })
    .join("")
    .trim();
  return (cleaned || "arquivo").slice(0, 120);
}

/** Chamada direta pelo componente client de upload (nao via <form>): gera a
 * URL assinada de envio para um anexo deste post. Admin-only. O upload vai
 * DIRETO ao storage (presigned) — o tipo/tamanho declarados aqui sao so'
 * cortesia (rejeicao antecipada); a autoridade e' o confirm, que le o objeto
 * real (validateUploadedObject). A rota /api/media revalida a autorizacao da
 * chave (posts/{tenant}/... upload = admin do mesmo tenant). */
export async function requestPostAttachmentUploadUrl(postId: string, declaredMime: string, declaredSize: number) {
  const session = await requireAdmin();

  if (!kindForContentType(declaredMime)) {
    return { error: "Tipo de arquivo não permitido. Aceitamos JPG, PNG, WEBP ou PDF." as const };
  }
  const limit = maxBytesForContentType(declaredMime);
  if (limit !== null && declaredSize > limit) {
    return { error: "Arquivo acima do tamanho máximo (imagem 5 MB, PDF 10 MB)." as const };
  }

  const withinCap = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    if (!(await findPostById(tx, session.tenantId, postId))) return false;
    return (await countPostMedia(tx, session.tenantId, postId)) < MAX_POST_ATTACHMENTS;
  });
  if (!withinCap) {
    return { error: `Máximo de ${MAX_POST_ATTACHMENTS} anexos por post.` as const };
  }

  const key = postMediaKey(session.tenantId, postId);
  const uploadUrl = await mediaStorage.getUploadUrl(key);
  return { uploadUrl, key };
}

export type ConfirmAttachmentResult = { ok: true } | { ok: false; error: string };

/** Pos-upload: le o cabeçalho do objeto no storage, valida tipo REAL (magic
 * number) + tamanho real, e so' entao grava PostMedia. Objeto reprovado ja' foi
 * apagado por validateUploadedObject — nunca vira anexo nem fica orfao valido. */
export async function confirmPostAttachmentUploadAction(
  postId: string,
  key: string,
  originalName: string,
): Promise<ConfirmAttachmentResult> {
  const session = await requireAdmin();
  const expectedPrefix = `posts/${session.tenantId}/${postId}/`;
  if (!key.startsWith(expectedPrefix)) {
    await mediaStorage.delete(key).catch(() => {});
    return { ok: false, error: "Chave de mídia inesperada." };
  }

  const validation = await validateUploadedObject(mediaStorage, key);
  if (!validation.ok) {
    return { ok: false, error: uploadRejectMessage(validation.reason) };
  }

  const stored = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    if (!(await findPostById(tx, session.tenantId, postId))) return false;
    // Reconfere o teto sob o contexto de tenant (corrida entre uploads paralelos).
    if ((await countPostMedia(tx, session.tenantId, postId)) >= MAX_POST_ATTACHMENTS) return false;

    await addPostMedia(tx, session.tenantId, postId, {
      mediaUrl: key,
      kind: validation.kind,
      mimeType: validation.contentType,
      originalName: sanitizeOriginalName(originalName),
      sizeBytes: validation.sizeBytes,
    });
    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "post.media.add",
      entity: "Post",
      entityId: postId,
      metadata: { kind: validation.kind, mime: validation.contentType, sizeBytes: validation.sizeBytes },
    });
    return true;
  });

  if (!stored) {
    // Post sumiu ou teto estourou na corrida: nao deixamos o objeto orfao.
    await mediaStorage.delete(key).catch(() => {});
    return { ok: false, error: `Não foi possível anexar (máximo de ${MAX_POST_ATTACHMENTS} anexos).` };
  }

  return { ok: true };
}

export async function removePostMediaAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const mediaId = String(formData.get("mediaId") ?? "");
  if (!id || !mediaId) redirect(`/${session.tenantSlug}/admin/posts`);

  // Apaga a linha e captura a chave para remover tambem o objeto no storage
  // (antes so' a linha era removida; com delete() na abstracao, nao deixamos
  // blob orfao — mesmo follow-up de storage fisico previsto para o R2).
  const removedKey = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const media = await findPostMediaById(tx, session.tenantId, mediaId);
    if (!media) return null;
    await removePostMedia(tx, session.tenantId, mediaId);
    return media.mediaUrl;
  });
  if (removedKey) await mediaStorage.delete(removedKey).catch(() => {});

  redirect(`/${session.tenantSlug}/admin/posts/${id}`);
}
