"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { isDebugEnabled } from "@/lib/debug/debug-flag";

// Boundary de erro do subtree do tenant (INC-024 Parte 2 / DP-30 / GAP-09).
//
// O boundary da raiz (src/app/error.tsx, INC-012.5 Q1) ja' cobre esta arvore —
// entao o valor deste arquivo NAO e' "deixar de mostrar tela em ingles", e' ser
// tenant-aware: o link de saida volta para a home DA EMPRESA (/{slug}) em vez
// da raiz institucional ("/"), que para um colaborador logado e' um beco
// (redireciona para login/selecao). O slug vem de useParams porque error.tsx e'
// Client Component por contrato do App Router e nao recebe params.
//
// Como o boundary da raiz, nunca renderiza error.message: pode carregar detalhe
// interno (query, caminho, id). A mensagem tecnica so' sai no log do INC-022.
export default function TenantError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ slug?: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : null;

  // INC-022: com a flag `conecta_debug` ligada, a falha tambem vai para o log do
  // servidor (type "boundary"). A tela mostrada NAO muda.
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
          message="Algo deu errado ao carregar esta página. Tente novamente em alguns instantes."
          onRetry={reset}
          retryLabel="Tentar novamente"
        />
        <Link
          href={slug ? `/${slug}` : "/"}
          className="text-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
