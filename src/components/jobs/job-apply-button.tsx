"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { applyToJobOpeningAction, cancelJobApplicationAction } from "../../lib/jobs/actions";

/**
 * Candidatura em 1 toque (INC-011), sem observação — usada na listagem/home
 * onde o card precisa caber numa unica acao rapida (design-system §4:
 * "botao candidatar-se em --action, 1 toque"). A observacao opcional fica
 * so' na tela de detalhe (JobApplicationPanel), que tem espaco pra um campo
 * de texto sem quebrar o card. Mesmo padrao de idempotencia em 3 camadas do
 * ReactionButton (INC-010): botao desabilita durante a chamada, a action
 * faz check-then-act, o banco e' o backstop pra corrida.
 */
export function JobApplyButton({
  jobOpeningId,
  initialApplied,
}: {
  jobOpeningId: string;
  initialApplied: boolean;
}) {
  const [applied, setApplied] = useState(initialApplied);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (isPending) return;
    const previous = applied;
    setError(null);
    setApplied(!applied);

    startTransition(async () => {
      const result = previous
        ? await cancelJobApplicationAction(jobOpeningId)
        : await applyToJobOpeningAction(jobOpeningId, null);
      if (!result.ok) {
        setApplied(previous);
        setError(result.reason === "closed" || result.reason === "not_found"
          ? "Esta vaga não aceita mais candidaturas."
          : "Não foi possível concluir. Tente novamente.");
      }
    });
  }

  return (
    <span className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={applied ? "outline" : "action"}
        size="touch"
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={applied}
        className="w-fit"
      >
        {applied ? "Candidatura enviada · Cancelar" : "Candidatar-se"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
