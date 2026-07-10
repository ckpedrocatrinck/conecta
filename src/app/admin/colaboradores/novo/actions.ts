"use server";

import { requireAdmin } from "../../../../lib/auth/session";
import { withTenant } from "../../../../lib/db/with-tenant";
import { hashCpf, normalizeCpf } from "../../../../lib/crypto/cpf-hash";
import { hashPassword } from "../../../../lib/crypto/password-hash";
import { generateProvisionalPassword } from "../../../../lib/crypto/provisional-password";
import { findBranchById } from "../../../../lib/repositories/branch.repository";
import { createEmployee, findUserByCpfHash, findUserByRegistrationCode } from "../../../../lib/repositories/user.repository";
import { recordAuditLog } from "../../../../lib/repositories/audit-log.repository";

export type CreateEmployeeState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ok"; provisionalPassword: string; fullName: string };

const VALID_ROLES = new Set(["admin", "manager", "employee"]);

export async function createEmployeeAction(
  _prevState: CreateEmployeeState,
  formData: FormData,
): Promise<CreateEmployeeState> {
  const session = await requireAdmin();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const registrationCode = String(formData.get("registrationCode") ?? "").trim();
  const cpf = String(formData.get("cpf") ?? "");
  const branchId = String(formData.get("branchId") ?? "");
  const role = String(formData.get("role") ?? "");
  const birthDate = String(formData.get("birthDate") ?? "");
  const hiredAt = String(formData.get("hiredAt") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!fullName || !registrationCode || !normalizeCpf(cpf) || !branchId || !VALID_ROLES.has(role)) {
    return { status: "error", message: "Preencha nome, matrícula, CPF, filial e papel." };
  }

  return withTenant({ tenantId: session.tenantId }, async (tx) => {
    const branch = await findBranchById(tx, session.tenantId, branchId);
    if (!branch) return { status: "error", message: "Filial inválida." };

    const cpfHash = hashCpf(cpf);
    const [byRegistration, byCpf] = await Promise.all([
      findUserByRegistrationCode(tx, session.tenantId, registrationCode),
      findUserByCpfHash(tx, session.tenantId, cpfHash),
    ]);
    if (byRegistration) return { status: "error", message: "Já existe colaborador com essa matrícula." };
    if (byCpf) return { status: "error", message: "Já existe colaborador com esse CPF." };

    const provisionalPassword = generateProvisionalPassword();
    const passwordHash = await hashPassword(provisionalPassword);

    const user = await createEmployee(tx, {
      tenantId: session.tenantId,
      branchId,
      role: role as "admin" | "manager" | "employee",
      fullName,
      registrationCode,
      cpfHash,
      passwordHash,
      birthDate: birthDate ? new Date(birthDate) : undefined,
      hiredAt: hiredAt ? new Date(hiredAt) : undefined,
      phone: phone || undefined,
      email: email || undefined,
    });

    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "employee.create",
      entity: "User",
      entityId: user.id,
      metadata: { registrationCode },
    });

    return { status: "ok", provisionalPassword, fullName };
  });
}
