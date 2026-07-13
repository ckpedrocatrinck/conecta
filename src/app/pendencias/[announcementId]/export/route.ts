import { NextResponse } from "next/server";
import { requireAdminOrManager } from "../../../../lib/auth/session";
import { withTenant } from "../../../../lib/db/with-tenant";
import { buildAnnouncementAckExportCsv } from "../../../../lib/csv/announcement-ack-export";
import { recordAuditLog } from "../../../../lib/repositories/audit-log.repository";

export async function GET(request: Request, { params }: { params: Promise<{ announcementId: string }> }) {
  const session = await requireAdminOrManager();
  const { announcementId } = await params;
  const isManager = session.role === "manager";
  const filial = new URL(request.url).searchParams.get("filial");
  const branchId = isManager ? session.branchId : filial || undefined;

  const result = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const csvExport = await buildAnnouncementAckExportCsv(tx, session.tenantId, announcementId, { branchId }, new Date());
    if (!csvExport) return null;

    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "announcement.export_ack_csv",
      entity: "Announcement",
      entityId: announcementId,
      metadata: { rowCount: csvExport.rowCount, branchId: branchId ?? null },
    });

    return csvExport;
  });

  if (!result) return new NextResponse(null, { status: 404 });

  return new NextResponse(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
