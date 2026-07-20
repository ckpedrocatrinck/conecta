"use server";

import { notFound, redirect } from "next/navigation";
import { requireAdminOrManager } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { remindPendingUsers } from "@/lib/announcements/remind-pending";
import { InAppNotificationChannel } from "@/lib/notifications/in-app-channel";
import { PushNotificationChannel } from "@/lib/notifications/push-channel";
import { CompositeNotificationChannel } from "@/lib/notifications/composite-channel";
import { recordAuditLog } from "@/lib/repositories/audit-log.repository";

// Push (INC-012) se combina ao canal in-app existente (INC-007) sem alterar
// remindPendingUsers/pending-panel.ts — o unico ponto de integracao e' este.
const notificationChannel = new CompositeNotificationChannel([
  new InAppNotificationChannel(),
  new PushNotificationChannel(),
]);

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
      notificationChannel,
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
  redirect(`/${session.tenantSlug}/pendencias/${announcementId}?cobranca=${outcome.notifiedCount}`);
}
