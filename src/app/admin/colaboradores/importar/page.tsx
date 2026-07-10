import { requireAdmin } from "../../../../lib/auth/session";
import { CSV_TEMPLATE_HEADER } from "../../../../lib/csv/employee-import";
import { ImportCsvForm } from "./form";

export default async function ImportarColaboradoresPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Importar colaboradores</h1>

      <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <p className="mb-2">
          Arquivo CSV com cabeçalho exato (colunas <code>filial</code> e <code>papel</code> usam o código da filial e um
          dos valores <code>admin</code>/<code>manager</code>/<code>employee</code>). Reimportar atualiza cadastro por
          matrícula — nunca mexe em senha ou CPF de quem já existe.
        </p>
        <pre className="overflow-x-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">{CSV_TEMPLATE_HEADER}</pre>
      </div>

      <ImportCsvForm />
    </div>
  );
}
