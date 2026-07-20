"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { createJobOpening } from "@/lib/repositories/job-opening.repository";
import { recordAuditLog } from "@/lib/repositories/audit-log.repository";

export async function createJobOpeningAction(formData: FormData) {
  const session = await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const branchId = String(formData.get("branchId") ?? "").trim();
  const shift = String(formData.get("shift") ?? "").trim();
  const requirements = String(formData.get("requirements") ?? "").trim();
  const deadlineRaw = String(formData.get("deadline") ?? "");

  const deadline = deadlineRaw ? new Date(deadlineRaw) : null;

  if (!title || !description || !deadline || Number.isNaN(deadline.getTime())) {
    redirect(`/${session.tenantSlug}/admin/vagas/novo?erro=obrigatorio`);
  }

  const jobId = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const job = await createJobOpening(tx, {
      tenantId: session.tenantId,
      title,
      description,
      branchId: branchId || null,
      shift: shift || null,
      requirements: requirements || null,
      deadline: deadline as Date,
      createdBy: session.userId,
    });

    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "job_opening.create",
      entity: "JobOpening",
      entityId: job.id,
    });

    return job.id;
  });

  redirect(`/${session.tenantSlug}/admin/vagas/${jobId}`);
}
