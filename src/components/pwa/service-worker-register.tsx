"use client";

import { useEffect } from "react";

/**
 * Registra public/sw.js uma vez, em qualquer pagina (login incluso) — nao
 * depende de sessao. Sem UI; puramente efeito de registro (INC-012).
 *
 * So' registra em producao (regressao real de QA): em `next dev`, o JS de
 * cada rota muda de conteudo sem trocar de URL (Fast Refresh/HMR nao usa
 * hash de build imutavel como o `next build` de producao usa) — um service
 * worker que chega a cachear esse JS (ou qualquer navegacao) fica servindo
 * versao velha/incompativel com o dev server em execucao, quebrando
 * hidratacao/onClick em qualquer tela. Producao (`next build`) usa hash de
 * conteudo por arquivo, entao cache la' e' seguro.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // Limpeza ativa: um SW registrado ANTES desta correcao (testado contra
      // `next dev`) continua instalado/controlando o dispositivo mesmo
      // depois que este componente parar de registrar — precisa ser
      // removido explicitamente, senao o bug persiste sem nenhum novo
      // registro acontecer.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) registration.unregister();
      });
      if ("caches" in globalThis) {
        caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Falha de registro (ex.: navegador sem suporte real) nao pode quebrar
      // o app — o PWA degrada para uma web app comum.
    });
  }, []);

  return null;
}
