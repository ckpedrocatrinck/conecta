"use client";

import { useEffect } from "react";

/** Registra public/sw.js uma vez, em qualquer pagina (login incluso) — nao
 * depende de sessao. Sem UI; puramente efeito de registro (INC-012). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Falha de registro (ex.: navegador sem suporte real) nao pode quebrar
      // o app — o PWA degrada para uma web app comum.
    });
  }, []);

  return null;
}
