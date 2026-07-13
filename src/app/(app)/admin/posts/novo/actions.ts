"use server";

import { redirect } from "next/navigation";
import type { PostType } from "@prisma/client";
import { requireAdmin } from "../../../../../lib/auth/session";
import { withTenant } from "../../../../../lib/db/with-tenant";
import { createPostDraft, replacePostPeople } from "../../../../../lib/repositories/post.repository";
import { recordAuditLog } from "../../../../../lib/repositories/audit-log.repository";

const VALID_TYPES = new Set<PostType>(["recognition", "tenure", "promotion", "general"]);

export async function createPostDraftAction(formData: FormData) {
  const session = await requireAdmin();

  const type = String(formData.get("type") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const eventDateRaw = String(formData.get("eventDate") ?? "");
  const branchId = String(formData.get("branchId") ?? "").trim();
  const personIds = formData.getAll("personIds").map(String);

  const eventDate = eventDateRaw ? new Date(eventDateRaw) : null;

  if (!VALID_TYPES.has(type as PostType) || !title || !eventDate || Number.isNaN(eventDate.getTime())) {
    redirect("/admin/posts/novo?erro=obrigatorio");
  }

  const postId = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const post = await createPostDraft(tx, {
      tenantId: session.tenantId,
      type: type as PostType,
      title,
      body: body || null,
      eventDate: eventDate as Date,
      branchId: branchId || null,
      createdBy: session.userId,
    });

    await replacePostPeople(
      tx,
      session.tenantId,
      post.id,
      personIds.map((userId) => ({ userId })),
    );

    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "post.create",
      entity: "Post",
      entityId: post.id,
      metadata: { type },
    });

    return post.id;
  });

  redirect(`/admin/posts/${postId}`);
}
