import Papa from "papaparse";
import type { Prisma } from "@prisma/client";
import { hashCpf, normalizeCpf } from "../crypto/cpf-hash";
import { hashPassword } from "../crypto/password-hash";
import { generateProvisionalPassword } from "../crypto/provisional-password";
import { findBranchByCode } from "../repositories/branch.repository";
import {
  createEmployee,
  findUserByCpfHash,
  findUserByRegistrationCode,
  updateEmployeeProfile,
} from "../repositories/user.repository";

// Template documentado do import (cabecalho exato, em pt-BR — reimport e'
// idempotente por matricula, ver decisao tecnica #3 do plano do INC-003):
// nome,matricula,cpf,filial,papel,data_nascimento,data_contratacao,telefone,email
export const CSV_TEMPLATE_HEADER =
  "nome,matricula,cpf,filial,papel,data_nascimento,data_contratacao,telefone,email";

const VALID_ROLES = new Set(["admin", "manager", "employee"]);

export type EmployeeCsvRow = {
  fullName: string;
  registrationCode: string;
  cpf: string;
  branchCode: string;
  role: "admin" | "manager" | "employee";
  birthDate?: Date;
  hiredAt?: Date;
  phone?: string;
  email?: string;
};

export type RowResult =
  | { line: number; status: "created"; registrationCode: string; provisionalPassword: string }
  | { line: number; status: "updated"; registrationCode: string }
  | { line: number; status: "error"; message: string };

function parseDate(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function validateRow(raw: Record<string, string>): { data: EmployeeCsvRow } | { error: string } {
  const fullName = (raw.nome ?? "").trim();
  const registrationCode = (raw.matricula ?? "").trim();
  const cpf = raw.cpf ?? "";
  const branchCode = (raw.filial ?? "").trim();
  const role = (raw.papel ?? "").trim();

  if (!fullName) return { error: "nome é obrigatório" };
  if (!registrationCode) return { error: "matrícula é obrigatória" };
  if (!normalizeCpf(cpf)) return { error: "cpf é obrigatório" };
  if (!branchCode) return { error: "filial é obrigatória" };
  if (!VALID_ROLES.has(role)) return { error: `papel inválido: "${role}" (use admin, manager ou employee)` };

  return {
    data: {
      fullName,
      registrationCode,
      cpf,
      branchCode,
      role: role as "admin" | "manager" | "employee",
      birthDate: parseDate(raw.data_nascimento ?? ""),
      hiredAt: parseDate(raw.data_contratacao ?? ""),
      phone: raw.telefone?.trim() || undefined,
      email: raw.email?.trim() || undefined,
    },
  };
}

export function parseEmployeeCsv(csvText: string): { line: number; raw: Record<string, string> }[] {
  const result = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
  // papaparse numera a partir dos dados (sem contar o cabecalho) — +2 alinha
  // com o numero da linha real no arquivo (1 = cabecalho, 2 = primeira linha de dados).
  return result.data.map((raw, index) => ({ line: index + 2, raw }));
}

/** Aplica UMA linha ja validada — cada chamada roda dentro do seu proprio
 * withTenant/transacao (o chamador decide o escopo). Reimport idempotente
 * por registrationCode: linha nova -> cria com senha provisoria; linha de
 * matricula existente -> so atualiza cadastro, nunca senha/cpf_hash. */
export async function applyEmployeeCsvRow(
  tx: Prisma.TransactionClient,
  tenantId: string,
  data: EmployeeCsvRow,
): Promise<{ status: "created"; provisionalPassword: string } | { status: "updated" } | { status: "error"; message: string }> {
  const branch = await findBranchByCode(tx, tenantId, data.branchCode);
  if (!branch) return { status: "error", message: `filial "${data.branchCode}" não encontrada` };

  const existing = await findUserByRegistrationCode(tx, tenantId, data.registrationCode);

  if (existing) {
    await updateEmployeeProfile(tx, tenantId, existing.id, {
      fullName: data.fullName,
      branchId: branch.id,
      role: data.role,
      birthDate: data.birthDate ?? null,
      hiredAt: data.hiredAt ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
    });
    return { status: "updated" };
  }

  const cpfHash = hashCpf(data.cpf);
  const cpfOwner = await findUserByCpfHash(tx, tenantId, cpfHash);
  if (cpfOwner) return { status: "error", message: `cpf já cadastrado sob a matrícula "${cpfOwner.registrationCode}"` };

  const provisionalPassword = generateProvisionalPassword();
  const passwordHash = await hashPassword(provisionalPassword);

  await createEmployee(tx, {
    tenantId,
    branchId: branch.id,
    role: data.role,
    fullName: data.fullName,
    registrationCode: data.registrationCode,
    cpfHash,
    passwordHash,
    birthDate: data.birthDate,
    hiredAt: data.hiredAt,
    phone: data.phone,
    email: data.email,
  });

  return { status: "created", provisionalPassword };
}

export { validateRow as validateEmployeeCsvRow };
