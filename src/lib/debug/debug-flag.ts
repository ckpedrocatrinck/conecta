// Porta UNICA de ativacao do reporter (INC-022): a flag em localStorage. Sem
// ela, nenhum listener e' registrado e o modulo pesado
// (client-error-reporter.ts) nem chega a ser baixado — o custo para o usuario
// real e' zero.
//
// Este arquivo e' de proposito minusculo e sem dependencia: ele SEMPRE entra no
// bundle (o componente de montagem e o error boundary precisam consultar a
// flag). Tudo que custa fica no modulo carregado sob demanda.

export const DEBUG_FLAG_KEY = "conecta_debug";
const DEBUG_FLAG_ON = "1";

/** Parametro de conveniencia para ligar/desligar no device sem devtools. */
const DEBUG_QUERY_PARAM = "debug";

export function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEBUG_FLAG_KEY) === DEBUG_FLAG_ON;
  } catch {
    // Safari em navegacao privada / storage bloqueado: sem flag, sem reporter.
    return false;
  }
}

/**
 * Le `?debug=1` (liga) ou `?debug=0` (desliga), grava a flag e RECARREGA sem o
 * parametro. Recarregar (em vez de so' limpar a URL) e' proposital: garante que
 * os listeners existam desde o primeiro byte do JS da pagina, senao um erro
 * disparado durante a hidratacao — o cenario que este INC investiga — passaria
 * batido. Tirar o parametro da URL evita que ele grude em bookmark/atalho do
 * PWA e reative a instrumentacao sem querer meses depois.
 *
 * Retorna true se um reload foi disparado (o chamador deve parar por aqui).
 */
export function applyDebugQueryParam(): boolean {
  if (typeof window === "undefined") return false;

  const url = new URL(window.location.href);
  const requested = url.searchParams.get(DEBUG_QUERY_PARAM);
  if (requested !== "1" && requested !== "0") return false;

  try {
    if (requested === "1") window.localStorage.setItem(DEBUG_FLAG_KEY, DEBUG_FLAG_ON);
    else window.localStorage.removeItem(DEBUG_FLAG_KEY);
  } catch {
    return false;
  }

  url.searchParams.delete(DEBUG_QUERY_PARAM);
  window.location.replace(url.toString());
  return true;
}
