"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { isDebugEnabled } from "@/lib/debug/debug-flag";

// Q1 (auditoria de usabilidade 2026-07): sem isto, qualquer exception num
// Server Component cai na tela padrao do Next em ingles ("Application
// error..."). error.tsx precisa ser Client Component (contrato do App
// Router) — so' recebe error/reset, nunca renderiza a mensagem tecnica pro
// usuario (poderia conter detalhe interno).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // INC-022: com a flag `conecta_debug` ligada, a falha tambem vai para o log
  // do servidor (type "boundary"). A tela mostrada NAO muda — message/stack so'
  // saem no POST, nunca na UI.
  useEffect(() => {
    if (!isDebugEnabled()) return;
    void import("@/lib/debug/client-error-reporter").then((module) => {
      module.reportBoundaryError(error);
    });
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-16">
      <div className="flex w-full max-w-sm flex-col gap-3">
        <ErrorState
          message="Algo deu errado. Tente novamente em alguns instantes."
          onRetry={reset}
          retryLabel="Tentar novamente"
        />
        <Link href="/" className="text-center text-sm font-semibold text-primary underline-offset-4 hover:underline">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
