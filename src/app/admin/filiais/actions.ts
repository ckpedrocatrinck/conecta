"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "../../../lib/auth/session";
import { withTenant } from "../../../lib/db/with-tenant";
import {
  countUsersInBranch,
  createBranch,
  deleteBranch,
  findBranchByCode,
  updateBranch,
} from "../../../lib/repositories/branch.repository";
import { recordAuditLog } from "../../../lib/repositories/audit-log.repository";

export async function createBranchAction(formData: FormData) {
  const session = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!name || !code) redirect("/admin/filiais?erro=obrigatorio");

  const outcome = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const existing = await findBranchByCode(tx, session.tenantId, code);
    if (existing) return "duplicado" as const;

    const branch = await createBranch(tx, { tenantId: session.tenantId, name, code });
    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "branch.create",
      entity: "Branch",
      entityId: branch.id,
      metadata: { name, code },
    });
    return "ok" as const;
  });

  if (outcome === "duplicado") redirect("/admin/filiais?erro=duplicado");
  redirect("/admin/filiais");
}

export async function updateBranchAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!id || !name || !code) redirect("/admin/filiais?erro=obrigatorio");

  await withTenant({ tenantId: session.tenantId }, async (tx) => {
    await updateBranch(tx, session.tenantId, id, { name, code });
    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "branch.update",
      entity: "Branch",
      entityId: id,
      metadata: { name, code },
    });
  });

  redirect("/admin/filiais");
}

export async function deleteBranchAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/filiais");

  const outcome = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const usersCount = await countUsersInBranch(tx, session.tenantId, id);
    if (usersCount > 0) return "em-uso" as const;

    await deleteBranch(tx, session.tenantId, id);
    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "branch.delete",
      entity: "Branch",
      entityId: id,
    });
    return "ok" as const;
  });

  if (outcome === "em-uso") redirect("/admin/filiais?erro=em-uso");
  redirect("/admin/filiais");
}
