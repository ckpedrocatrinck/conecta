"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "../../../../../lib/auth/session";
import { withTenant } from "../../../../../lib/db/with-tenant";
import { sanitizeAnnouncementBody } from "../../../../../lib/sanitize/announcement-body";
import { createAnnouncementDraft } from "../../../../../lib/repositories/announcement.repository";
import { createAnnouncementVersion } from "../../../../../lib/repositories/announcement-version.repository";
import { replaceAnnouncementAudience } from "../../../../../lib/repositories/announcement-audience.repository";
import { recordAuditLog } from "../../../../../lib/repositories/audit-log.repository";

const VALID_CRITICALITY = new Set(["info", "requires_ack"]);

export async function createAnnouncementDraftAction(formData: FormData) {
  const session = await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const criticality = String(formData.get("criticality") ?? "");
  const branchIds = formData.getAll("branchIds").map(String);

  if (!title || !body || !category || !VALID_CRITICALITY.has(criticality)) {
    redirect("/admin/comunicados/novo?erro=obrigatorio");
  }

  const announcementId = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const announcement = await createAnnouncementDraft(tx, {
      tenantId: session.tenantId,
      category,
      criticality: criticality as "info" | "requires_ack",
      createdBy: session.userId,
    });

    await createAnnouncementVersion(tx, {
      tenantId: session.tenantId,
      announcementId: announcement.id,
      title,
      body: sanitizeAnnouncementBody(body),
      createdBy: session.userId,
    });

    await replaceAnnouncementAudience(tx, session.tenantId, announcement.id, branchIds);

    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "announcement.create_draft",
      entity: "Announcement",
      entityId: announcement.id,
    });

    return announcement.id;
  });

  redirect(`/admin/comunicados/${announcementId}`);
}
