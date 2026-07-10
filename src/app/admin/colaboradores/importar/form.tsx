"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { importEmployeesCsvAction, type ImportCsvState } from "./actions";

const INITIAL_STATE: ImportCsvState = { status: "idle" };

export function ImportCsvForm() {
  const [state, formAction, pending] = useActionState(importEmployeesCsvAction, INITIAL_STATE);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
        {state.status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Importando..." : "Importar"}
        </Button>
      </form>

      {state.status === "done" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            {state.created} criado(s), {state.updated} atualizado(s), {state.errors} erro(s) de {state.results.length}{" "}
            linha(s).
          </p>

          <div className="flex flex-col gap-1">
            {state.results.map((result) => (
              <div
                key={result.line}
                className={`rounded border p-2 text-sm ${
                  result.status === "error"
                    ? "border-destructive/40 bg-destructive/5 text-destructive"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <span className="font-mono text-xs text-zinc-500">linha {result.line}</span>{" "}
                {result.status === "error" && <>— erro: {result.message}</>}
                {result.status === "updated" && <>— matrícula {result.registrationCode} atualizada</>}
                {result.status === "created" && (
                  <>
                    — matrícula {result.registrationCode} criada. Senha provisória:{" "}
                    <span className="font-mono">{result.provisionalPassword}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
