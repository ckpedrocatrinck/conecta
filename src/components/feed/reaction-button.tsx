"use client";

import { useState, useTransition } from "react";
import { togglePostReactionAction } from "../../lib/reactions/actions";

/**
 * Reacao unica (👏) por post (INC-010). Verde (`--primary`), nao laranja
 * (`--action`) — regra do design-system (§0.1/§2): laranja e' exclusivo de
 * acao que o produto EXIGE do usuario (declarar ciencia, candidatar-se);
 * aplaudir e' engajamento leve, nao uma pendencia.
 *
 * Idempotencia (camada de UI): o botao fica desabilitado enquanto a chamada
 * anterior nao volta (`isPending`), entao um toque duplo rapido do MESMO
 * usuario nunca dispara uma segunda request — a camada de banco
 * (togglePostReactionAction) e' o backstop pra corrida entre abas/devices.
 * Atualizacao otimista: aplica o novo estado na hora, reverte so' se a
 * server action falhar.
 */
export function ReactionButton({
  postId,
  initialReacted,
  initialCount,
}: {
  postId: string;
  initialReacted: boolean;
  initialCount: number;
}) {
  const [reacted, setReacted] = useState(initialReacted);
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (isPending) return;
    const previous = { reacted, count };
    setReacted(!reacted);
    setCount(reacted ? count - 1 : count + 1);

    startTransition(async () => {
      try {
        const result = await togglePostReactionAction(postId);
        setReacted(result.reacted);
        setCount(result.count);
      } catch {
        setReacted(previous.reacted);
        setCount(previous.count);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={reacted}
      className={
        reacted
          ? "flex w-fit items-center gap-1.5 rounded-full bg-primary-subtle px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-70"
          : "flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-70"
      }
    >
      <span aria-hidden="true">👏</span>
      <span>{count > 0 ? count : "Aplaudir"}</span>
    </button>
  );
}
