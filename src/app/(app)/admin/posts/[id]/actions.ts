"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import type { PostType } from "@prisma/client";
import { requireAdmin } from "../../../../../lib/auth/session";
import { withTenant } from "../../../../../lib/db/with-tenant";
import {
  addPostMedia,
  publishPost,
  removePostMedia,
  replacePostPeople,
  updatePostFields,
} from "../../../../../lib/repositories/post.repository";
import { recordAuditLog } from "../../../../../lib/repositories/audit-log.repository";
import { mediaStorage } from "../../../../../lib/storage/media-storage";

const VALID_TYPES = new Set<PostType>(["recognition", "tenure", "promotion", "general"]);

export async function updatePostAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const type = String(formData.get("type") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const eventDateRaw = String(formData.get("eventDate") ?? "");
  const branchId = String(formData.get("branchId") ?? "").trim();
  const personIds = formData.getAll("personIds").map(String);

  const eventDate = eventDateRaw ? new Date(eventDateRaw) : null;

  if (!id || !VALID_TYPES.has(type as PostType) || !title || !eventDate || Number.isNaN(eventDate.getTime())) {
    redirect(`/admin/posts/${id}?erro=obrigatorio`);
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
  });

  redirect(`/admin/posts/${id}?salvo=ok`);
}

export async function publishPostAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/posts");

  await withTenant({ tenantId: session.tenantId }, async (tx) => {
    await publishPost(tx, session.tenantId, id);
    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "post.publish",
      entity: "Post",
      entityId: id,
    });
  });

  redirect(`/admin/posts/${id}?ok=publicado`);
}

function postMediaKey(tenantId: string, postId: string): string {
  return `posts/${tenantId}/${postId}/${randomUUID()}`;
}

/** Chamada direta pelo componente client de upload (nao via <form>): gera a
 * URL assinada de envio para uma foto deste post especifico. Admin-only —
 * a rota /api/media/[key] revalida isso de novo na autorizacao da chave. */
export async function requestPostMediaUploadUrl(postId: string) {
  const session = await requireAdmin();
  const key = postMediaKey(session.tenantId, postId);
  const uploadUrl = await mediaStorage.getUploadUrl(key);
  return { uploadUrl, key };
}

export async function confirmPostMediaUploadAction(postId: string, key: string) {
  const session = await requireAdmin();
  const expectedPrefix = `posts/${session.tenantId}/${postId}/`;
  if (!key.startsWith(expectedPrefix)) throw new Error("chave de mídia inesperada");

  await withTenant({ tenantId: session.tenantId }, (tx) => addPostMedia(tx, session.tenantId, postId, key));
}

export async function removePostMediaAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const mediaId = String(formData.get("mediaId") ?? "");
  if (!id || !mediaId) redirect("/admin/posts");

  await withTenant({ tenantId: session.tenantId }, (tx) => removePostMedia(tx, session.tenantId, mediaId));

  redirect(`/admin/posts/${id}`);
}
