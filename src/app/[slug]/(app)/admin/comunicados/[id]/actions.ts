"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { sanitizeAnnouncementBody } from "@/lib/sanitize/announcement-body";
import {
  archiveAnnouncement,
  findAnnouncementById,
  scheduleAnnouncementPublication,
  unscheduleAnnouncement,
  updateAnnouncementCategory,
  updateAnnouncementCriticality,
} from "@/lib/repositories/announcement.repository";
import { createAnnouncementVersion } from "@/lib/repositories/announcement-version.repository";
import { replaceAnnouncementAudience } from "@/lib/repositories/announcement-audience.repository";
import { publishAnnouncement } from "@/lib/announcements/publish";
import { recordAuditLog } from "@/lib/repositories/audit-log.repository";

const VALID_CRITICALITY = new Set(["info", "requires_ack"]);

export async function saveAnnouncementContentAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const criticality = String(formData.get("criticality") ?? "");
  const branchIds = formData.getAll("branchIds").map(String);
  const isMaterialChange = formData.get("isMaterialChange") === "on";

  if (!id || !title || !body || !category) redirect(`/${session.tenantSlug}/admin/comunicados/${id}?erro=obrigatorio`);

  await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const current = await findAnnouncementById(tx, session.tenantId, id);
    if (!current || current.status === "archived") return;

    await createAnnouncementVersion(tx, {
      tenantId: session.tenantId,
      announcementId: id,
      title,
      body: sanitizeAnnouncementBody(body),
      createdBy: session.userId,
      isMaterialChange: current.status === "published" && current.criticality === "requires_ack" && isMaterialChange,
    });

    await updateAnnouncementCategory(tx, session.tenantId, id, category);

    if (current.seqNumber === null && VALID_CRITICALITY.has(criticality)) {
      await updateAnnouncementCriticality(tx, session.tenantId, id, criticality as "info" | "requires_ack");
    }

    await replaceAnnouncementAudience(tx, session.tenantId, id, branchIds);

    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "announcement.save_version",
      entity: "Announcement",
      entityId: id,
      metadata: { isMaterialChange },
    });
  });

  redirect(`/${session.tenantSlug}/admin/comunicados/${id}?salvo=ok`);
}

export async function publishAnnouncementNowAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`/${session.tenantSlug}/admin/comunicados`);

  const outcome = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const result = await publishAnnouncement(tx, { tenantId: session.tenantId, announcementId: id });
    if (result.status === "published") {
      await recordAuditLog(tx, {
        tenantId: session.tenantId,
        actorUserId: session.userId,
        action: "announcement.publish",
        entity: "Announcement",
        entityId: id,
        metadata: { seqNumber: result.seqNumber, year: result.year },
      });
    }
    return result;
  });

  redirect(`/${session.tenantSlug}/admin/comunicados/${id}${outcome.status === "skipped" ? "?erro=ja-publicado" : "?ok=publicado"}`);
}

export async function scheduleAnnouncementAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const publishAtRaw = String(formData.get("publishAt") ?? "");
  const publishAt = publishAtRaw ? new Date(publishAtRaw) : null;
  if (!id || !publishAt || Number.isNaN(publishAt.getTime())) {
    redirect(`/${session.tenantSlug}/admin/comunicados/${id}?erro=data-invalida`);
  }

  await withTenant({ tenantId: session.tenantId }, async (tx) => {
    await scheduleAnnouncementPublication(tx, session.tenantId, id, publishAt as Date);
    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "announcement.schedule",
      entity: "Announcement",
      entityId: id,
      metadata: { publishAt: (publishAt as Date).toISOString() },
    });
  });

  redirect(`/${session.tenantSlug}/admin/comunicados/${id}?ok=agendado`);
}

export async function unscheduleAnnouncementAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`/${session.tenantSlug}/admin/comunicados`);

  await withTenant({ tenantId: session.tenantId }, async (tx) => {
    await unscheduleAnnouncement(tx, session.tenantId, id);
    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "announcement.unschedule",
      entity: "Announcement",
      entityId: id,
    });
  });

  redirect(`/${session.tenantSlug}/admin/comunicados/${id}?ok=cancelado`);
}

export async function archiveAnnouncementAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`/${session.tenantSlug}/admin/comunicados`);

  await withTenant({ tenantId: session.tenantId }, async (tx) => {
    await archiveAnnouncement(tx, session.tenantId, id);
    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "announcement.archive",
      entity: "Announcement",
      entityId: id,
    });
  });

  redirect(`/${session.tenantSlug}/admin/comunicados/${id}?ok=arquivado`);
}
