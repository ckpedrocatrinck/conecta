"use client";

import { useEffect } from "react";
import { applyDebugQueryParam, isDebugEnabled } from "@/lib/debug/debug-flag";

/**
 * Montagem do reporter de erro client-side (INC-022). Sem UI: so' consulta a
 * flag e, se — e somente se — ela estiver ligada, baixa o modulo pesado.
 *
 * O `import()` dinamico e' o que garante o criterio "flag desativada = nenhum
 * import do modulo pesado": o bundler emite client-error-reporter.ts num chunk
 * separado, buscado em runtime. (O INC pedia `next/dynamic` com `ssr: false`,
 * que o App Router nao aceita dentro de um Server Component como o layout raiz
 * — o efeito no bundle e' o mesmo, e aqui o gate ainda e' mais estrito: nem o
 * chunk e' pedido quando a flag esta desligada.)
 *
 * Montado no layout raiz, ao lado de ServiceWorkerRegister, para valer tambem
 * antes do login — erro na tela de login e' um dos cenarios a investigar.
 */
export function ClientErrorReporter() {
  useEffect(() => {
    // `?debug=1` / `?debug=0` recarrega a pagina; nao adianta seguir aqui.
    if (applyDebugQueryParam()) return;
    if (!isDebugEnabled()) return;

    void import("@/lib/debug/client-error-reporter").then((module) => {
      module.setupClientErrorReporter();
    });
  }, []);

  return null;
}
