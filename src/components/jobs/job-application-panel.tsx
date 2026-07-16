"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatDateTimeSaoPaulo } from "@/lib/dates/format-datetime";
import { applyToJobOpeningAction, cancelJobApplicationAction, type ApplyResult } from "../../lib/jobs/actions";

export type MyApplication = { note: string | null; createdAt: string };

/**
 * Painel de candidatura da tela de detalhe (INC-011) — aqui, com espaco
 * de sobra (ao contrario do card da listagem), a observacao opcional fica
 * disponivel antes do 1o toque de "Candidatar-se". Depois de candidatado,
 * mostra o que foi enviado e permite cancelar enquanto a vaga aceitar
 * candidatura (o botao some/ e a action rejeita se a vaga ja fechou —
 * `closed`/`not_found` tratados como estado desatualizado, recarrega).
 */
export function JobApplicationPanel({
  jobOpeningId,
  initialApplication,
  canApply,
}: {
  jobOpeningId: string;
  initialApplication: MyApplication | null;
  canApply: boolean;
}) {
  const router = useRouter();
  const [application, setApplication] = useState(initialApplication);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // "closed"/"not_found" = a tela ficou aberta desde antes da vaga
  // fechar/vencer (R11): recarrega os dados do servidor em vez de deixar o
  // usuario tentar de novo contra um estado que nunca vai funcionar.
  function handleOutcome(result: ApplyResult, onOk: () => void) {
    if (result.ok) {
      onOk();
      return;
    }
    if (result.reason === "closed" || result.reason === "not_found") {
      setErrorMessage("Esta vaga não aceita mais candidaturas.");
      router.refresh();
      return;
    }
    setErrorMessage("Não foi possível concluir. Tente novamente.");
  }

  function handleApply() {
    if (isPending) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await applyToJobOpeningAction(jobOpeningId, note || null);
      handleOutcome(result, () => setApplication({ note: note || null, createdAt: new Date().toISOString() }));
    });
  }

  function handleCancel() {
    if (isPending) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await cancelJobApplicationAction(jobOpeningId);
      handleOutcome(result, () => {
        setApplication(null);
        setNote("");
      });
    });
  }

  if (!canApply && !application) {
    return <p className="text-sm text-muted-foreground">Esta vaga não está mais aceitando candidaturas.</p>;
  }

  if (application) {
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-primary-subtle p-3">
        <p className="text-sm font-semibold text-foreground">
          Candidatura enviada em {formatDateTimeSaoPaulo(new Date(application.createdAt))}
        </p>
        {application.note && <p className="text-sm text-foreground">{application.note}</p>}
        {canApply && (
          <Button type="button" variant="secondary" size="sm" className="self-start" onClick={handleCancel} disabled={isPending}>
            Cancelar candidatura
          </Button>
        )}
        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="note" className="text-sm font-medium text-foreground">
          Observação (opcional)
        </label>
        <textarea
          id="note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm dark:bg-input/30"
        />
      </div>
      <Button type="button" variant="action" size="lg" className="self-start" onClick={handleApply} disabled={isPending}>
        Candidatar-se
      </Button>
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </div>
  );
}
