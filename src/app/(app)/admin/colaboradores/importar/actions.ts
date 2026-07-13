"use server";

import { requireAdmin } from "../../../../../lib/auth/session";
import { withTenant } from "../../../../../lib/db/with-tenant";
import {
  applyEmployeeCsvRow,
  parseEmployeeCsv,
  validateEmployeeCsvRow,
  type RowResult,
} from "../../../../../lib/csv/employee-import";
import { recordAuditLog } from "../../../../../lib/repositories/audit-log.repository";

export type ImportCsvState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; results: RowResult[]; created: number; updated: number; errors: number };

export async function importEmployeesCsvAction(
  _prevState: ImportCsvState,
  formData: FormData,
): Promise<ImportCsvState> {
  const session = await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Selecione um arquivo CSV." };
  }

  const csvText = await file.text();
  const rows = parseEmployeeCsv(csvText);
  if (rows.length === 0) {
    return { status: "error", message: "O arquivo não tem linhas de dados." };
  }

  const results: RowResult[] = [];

  // Cada linha roda no seu proprio withTenant/transacao de proposito: um
  // erro numa linha (FK, constraint) nao pode abortar as linhas seguintes
  // dentro da mesma transacao Postgres (sem SAVEPOINT por linha, o
  // primeiro erro invalidaria o resto da transacao inteira).
  for (const { line, raw } of rows) {
    const validation = validateEmployeeCsvRow(raw);
    if ("error" in validation) {
      results.push({ line, status: "error", message: validation.error });
      continue;
    }

    try {
      const outcome = await withTenant({ tenantId: session.tenantId }, (tx) =>
        applyEmployeeCsvRow(tx, session.tenantId, validation.data),
      );
      if (outcome.status === "error") {
        results.push({ line, status: "error", message: outcome.message });
      } else if (outcome.status === "created") {
        results.push({
          line,
          status: "created",
          registrationCode: validation.data.registrationCode,
          provisionalPassword: outcome.provisionalPassword,
        });
      } else {
        results.push({ line, status: "updated", registrationCode: validation.data.registrationCode });
      }
    } catch {
      results.push({ line, status: "error", message: "erro inesperado ao gravar esta linha" });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const updated = results.filter((r) => r.status === "updated").length;
  const errors = results.filter((r) => r.status === "error").length;

  await withTenant({ tenantId: session.tenantId }, (tx) =>
    recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "employee.import_csv",
      entity: "User",
      entityId: session.tenantId,
      metadata: { totalRows: rows.length, created, updated, errors },
    }),
  );

  return { status: "done", results, created, updated, errors };
}
