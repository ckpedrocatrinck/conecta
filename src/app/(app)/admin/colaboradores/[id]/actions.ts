"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "../../../../../lib/auth/session";
import { withTenant } from "../../../../../lib/db/with-tenant";
import { hashPassword } from "../../../../../lib/crypto/password-hash";
import { generateProvisionalPassword } from "../../../../../lib/crypto/provisional-password";
import { findBranchById } from "../../../../../lib/repositories/branch.repository";
import { findUserById, resetEmployeePassword, setEmployeeStatus, updateEmployeeProfile } from "../../../../../lib/repositories/user.repository";
import { recordAuditLog } from "../../../../../lib/repositories/audit-log.repository";
import { revokeOtherUserSessions } from "../../../../../lib/repositories/session.repository";

const VALID_ROLES = new Set(["admin", "manager", "employee"]);

export async function updateEmployeeAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const branchId = String(formData.get("branchId") ?? "");
  const role = String(formData.get("role") ?? "");
  const birthDate = String(formData.get("birthDate") ?? "");
  const hiredAt = String(formData.get("hiredAt") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!id || !fullName || !branchId || !VALID_ROLES.has(role)) {
    redirect(`/admin/colaboradores/${id}?erro=obrigatorio`);
  }

  const outcome = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const branch = await findBranchById(tx, session.tenantId, branchId);
    if (!branch) return "filial-invalida" as const;

    const before = await findUserById(tx, session.tenantId, id);

    await updateEmployeeProfile(tx, session.tenantId, id, {
      fullName,
      branchId,
      role: role as "admin" | "manager" | "employee",
      birthDate: birthDate ? new Date(birthDate) : null,
      hiredAt: hiredAt ? new Date(hiredAt) : null,
      phone: phone || null,
      email: email || null,
    });

    // Trilha de mudanca de privilegio (LGPD/auditoria) — so' grava
    // previousRole/newRole quando o papel de fato muda, nunca dado pessoal.
    const roleChanged = before != null && before.role !== role;

    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "employee.update",
      entity: "User",
      entityId: id,
      metadata: roleChanged ? { roleChanged: true, previousRole: before.role, newRole: role } : undefined,
    });

    return "ok" as const;
  });

  if (outcome === "filial-invalida") redirect(`/admin/colaboradores/${id}?erro=filial`);
  redirect(`/admin/colaboradores/${id}?sucesso=1`);
}

export async function toggleEmployeeStatusAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const nextStatus = formData.get("nextStatus") === "active" ? "active" : "inactive";
  if (!id) redirect("/admin/colaboradores");

  await withTenant({ tenantId: session.tenantId }, async (tx) => {
    await setEmployeeStatus(tx, session.tenantId, id, nextStatus);
    if (nextStatus === "inactive") {
      // Desligamento tira acesso na hora (ADR-006) — nao so' o proximo login.
      await revokeOtherUserSessions(tx, id);
    }
    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: nextStatus === "active" ? "employee.activate" : "employee.deactivate",
      entity: "User",
      entityId: id,
    });
  });

  redirect(`/admin/colaboradores/${id}?sucesso=1`);
}

export type ResetPasswordState = { status: "idle" } | { status: "ok"; provisionalPassword: string };

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const provisionalPassword = generateProvisionalPassword();
  const passwordHash = await hashPassword(provisionalPassword);

  await withTenant({ tenantId: session.tenantId }, async (tx) => {
    await resetEmployeePassword(tx, session.tenantId, id, passwordHash);
    await revokeOtherUserSessions(tx, id);
    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "employee.reset_password",
      entity: "User",
      entityId: id,
    });
  });

  return { status: "ok", provisionalPassword };
}
