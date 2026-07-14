"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatDateTimeSaoPaulo } from "@/lib/dates/format-datetime";
import { applyToJobOpeningAction, cancelJobApplicationAction } from "../../lib/jobs/actions";

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
  const [application, setApplication] = useState(initialApplication);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function handleApply() {
    if (isPending) return;
    setError(false);
    startTransition(async () => {
      const result = await applyToJobOpeningAction(jobOpeningId, note || null);
      if (!result.ok) {
        setError(true);
        return;
      }
      setApplication({ note: note || null, createdAt: new Date().toISOString() });
    });
  }

  function handleCancel() {
    if (isPending) return;
    setError(false);
    startTransition(async () => {
      const result = await cancelJobApplicationAction(jobOpeningId);
      if (!result.ok) {
        setError(true);
        return;
      }
      setApplication(null);
      setNote("");
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
        {error && <p className="text-sm text-destructive">Não foi possível atualizar sua candidatura. Tente novamente.</p>}
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
      {error && <p className="text-sm text-destructive">Não foi possível enviar sua candidatura. Tente novamente.</p>}
    </div>
  );
}
