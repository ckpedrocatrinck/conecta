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
        <input type="file" name="file" accept=".csv,text/csv" required className="text-body file:mr-3 file:rounded-lg file:border-[1.5px] file:border-border-strong file:bg-card file:px-3 file:py-2 file:text-sm file:font-semibold file:text-foreground" />
        {state.status === "error" && (
          <p role="alert" className="text-meta text-destructive">
            {state.message}
          </p>
        )}
        <Button type="submit" size="touch" disabled={pending} className="self-start">
          {pending ? "Importando..." : "Importar"}
        </Button>
      </form>

      {state.status === "done" && (
        <div className="flex flex-col gap-3">
          <p className="text-body">
            {state.created} criado(s), {state.updated} atualizado(s), {state.errors} erro(s) de {state.results.length}{" "}
            linha(s).
          </p>

          <div className="flex flex-col gap-1">
            {state.results.map((result) => (
              <div
                key={result.line}
                className={`rounded-lg border p-2 text-meta ${
                  result.status === "error"
                    ? "border-destructive/40 bg-destructive/5 text-destructive"
                    : "border-border bg-card"
                }`}
              >
                <span className="font-mono text-xs text-subtle-foreground">linha {result.line}</span>{" "}
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
