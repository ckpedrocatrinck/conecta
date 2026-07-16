"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "../../../../../lib/auth/session";
import { withTenant } from "../../../../../lib/db/with-tenant";
import { closeJobOpeningManually, updateJobOpeningFields } from "../../../../../lib/repositories/job-opening.repository";
import { recordAuditLog } from "../../../../../lib/repositories/audit-log.repository";

export async function updateJobOpeningAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const branchId = String(formData.get("branchId") ?? "").trim();
  const shift = String(formData.get("shift") ?? "").trim();
  const requirements = String(formData.get("requirements") ?? "").trim();
  const deadlineRaw = String(formData.get("deadline") ?? "");

  const deadline = deadlineRaw ? new Date(deadlineRaw) : null;

  if (!id || !title || !description || !deadline || Number.isNaN(deadline.getTime())) {
    redirect(`/admin/vagas/${id}?erro=obrigatorio`);
  }

  await withTenant({ tenantId: session.tenantId }, async (tx) => {
    await updateJobOpeningFields(tx, session.tenantId, id, {
      title,
      description,
      branchId: branchId || null,
      shift: shift || null,
      requirements: requirements || null,
      deadline: deadline as Date,
    });

    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "job_opening.update",
      entity: "JobOpening",
      entityId: id,
    });
  });

  redirect(`/admin/vagas/${id}?salvo=ok`);
}

export async function closeJobOpeningAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/vagas");

  await withTenant({ tenantId: session.tenantId }, async (tx) => {
    await closeJobOpeningManually(tx, session.tenantId, id);
    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "job_opening.close",
      entity: "JobOpening",
      entityId: id,
    });
  });

  redirect(`/admin/vagas/${id}?ok=fechada`);
}
