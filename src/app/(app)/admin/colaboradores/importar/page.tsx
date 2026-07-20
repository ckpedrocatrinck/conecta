import { requireAdmin } from "../../../../../lib/auth/session";
import { CSV_TEMPLATE_HEADER } from "../../../../../lib/csv/employee-import";
import { ImportCsvForm } from "./form";

export default async function ImportarColaboradoresPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-display text-foreground">Importar colaboradores</h1>

      <div className="max-w-2xl rounded-[var(--radius-card)] border border-border bg-card p-4 text-body shadow-[var(--shadow-card)]">
        <p className="mb-2">
          Arquivo CSV com cabeçalho exato (colunas <code>filial</code> e <code>papel</code> usam o código da filial e um
          dos valores <code>admin</code>/<code>manager</code>/<code>employee</code>). Reimportar atualiza cadastro por
          matrícula — nunca mexe em senha ou CPF de quem já existe.
        </p>
        <pre className="overflow-x-auto rounded-lg bg-muted p-2 text-xs text-foreground-soft">{CSV_TEMPLATE_HEADER}</pre>
      </div>

      <ImportCsvForm />
    </div>
  );
}
