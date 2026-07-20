import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { buildJobApplicationExportCsv } from "@/lib/csv/job-application-export";
import { recordAuditLog } from "@/lib/repositories/audit-log.repository";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  const { id } = await params;

  const result = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const csvExport = await buildJobApplicationExportCsv(tx, session.tenantId, id, new Date());
    if (!csvExport) return null;

    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "job_opening.export_applicants_csv",
      entity: "JobOpening",
      entityId: id,
      metadata: { rowCount: csvExport.rowCount },
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
