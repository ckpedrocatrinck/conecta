"use server";

import { notFound, redirect } from "next/navigation";
import { requireAdminOrManager } from "../../../lib/auth/session";
import { withTenant } from "../../../lib/db/with-tenant";
import { remindPendingUsers } from "../../../lib/announcements/remind-pending";
import { InAppNotificationChannel } from "../../../lib/notifications/in-app-channel";
import { recordAuditLog } from "../../../lib/repositories/audit-log.repository";

const inAppChannel = new InAppNotificationChannel();

export async function remindPendingAction(formData: FormData) {
  const session = await requireAdminOrManager();
  const announcementId = String(formData.get("announcementId") ?? "");
  if (!announcementId) notFound();
  const isManager = session.role === "manager";

  const outcome = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const result = await remindPendingUsers(
      tx,
      session.tenantId,
      announcementId,
      { branchId: isManager ? session.branchId : undefined },
      inAppChannel,
    );
    if (!result) return null;

    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "announcement.remind_pending",
      entity: "Announcement",
      entityId: announcementId,
      metadata: { notifiedCount: result.notifiedCount },
    });

    return result;
  });

  if (!outcome) notFound();
  redirect(`/pendencias/${announcementId}?cobranca=${outcome.notifiedCount}`);
}
