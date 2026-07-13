"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { resetPasswordAction, type ResetPasswordState } from "./actions";

const INITIAL_STATE: ResetPasswordState = { status: "idle" };

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, INITIAL_STATE);

  if (state.status === "ok") {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950">
        <p>Nova senha provisória (repasse ao colaborador — só aparece aqui, uma vez):</p>
        <p className="rounded bg-white px-3 py-2 font-mono text-base tracking-wider dark:bg-black">
          {state.provisionalPassword}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={userId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Gerando..." : "Redefinir senha"}
      </Button>
    </form>
  );
}
