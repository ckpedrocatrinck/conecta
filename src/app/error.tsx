"use client";

import Link from "next/link";
import { ErrorState } from "@/components/ui/error-state";

// Q1 (auditoria de usabilidade 2026-07): sem isto, qualquer exception num
// Server Component cai na tela padrao do Next em ingles ("Application
// error..."). error.tsx precisa ser Client Component (contrato do App
// Router) — so' recebe error/reset, nunca renderiza a mensagem tecnica pro
// usuario (poderia conter detalhe interno).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
