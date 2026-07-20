"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { resetPasswordAction, type ResetPasswordState } from "./actions";

const INITIAL_STATE: ResetPasswordState = { status: "idle" };

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, INITIAL_STATE);

  if (state.status === "ok") {
    return (
      <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-primary-subtle p-3 text-meta text-foreground">
        <p>Nova senha provisória (repasse ao colaborador — só aparece aqui, uma vez):</p>
        <p className="rounded-lg border border-border bg-card px-3 py-2 font-mono text-base tracking-wider text-foreground">
          {state.provisionalPassword}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={userId} />
      <Button type="submit" variant="outline" size="touch" disabled={pending}>
        {pending ? "Gerando..." : "Redefinir senha"}
      </Button>
    </form>
  );
}
