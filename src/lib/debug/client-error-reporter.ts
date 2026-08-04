// Modulo PESADO do reporter (INC-022): so' e' baixado quando a flag
// `conecta_debug` esta ligada (import() dinamico em ClientErrorReporter e no
// error boundary). Registra os listeners globais e envia cada ocorrencia para
// /api/debug/client-error.
//
// Existe porque ha' bloqueios reportados em iPhone real (aplaudir, trocar foto,
// candidatar-se, push) sem Mac disponivel para o Web Inspector — este e' o
// unico canal de visibilidade do que acontece no client do device.
//
// REGRA DE PRIVACIDADE (LGPD, CLAUDE.md "nunca logar dado pessoal"): so' saem
// daqui os campos do schema fixo. Nunca `event.target` (pode ser um <input>/
// <form> com CPF/senha digitados), nunca `document.forms`, nunca a
// querystring, nunca cookie (o fetch vai com credentials "omit"). Valor de
// rejeicao que nao seja Error/string vira so' o NOME do tipo — um objeto
// arbitrario poderia carregar dado do usuario dentro.

import {
  CLIENT_ERROR_ENDPOINT,
  MAX_MESSAGE_LENGTH,
  MAX_STACK_LENGTH,
  type ClientErrorPayload,
  type ClientErrorType,
} from "./client-error-contract";
import { extractTenantSlug } from "@/lib/tenant/slug-path";

/** Mesma mensagem dentro desta janela nao reenvia (um erro em loop de render
 * dispararia centenas de POSTs por segundo e estouraria o rate limit). */
const DEDUPE_WINDOW_MS = 2000;

const lastSentAt = new Map<string, number>();

/** Guarda anti-recursao: enquanto montamos/enviamos, um console.error nosso (ou
 * de dentro do fetch) nao pode re-disparar o wrap e entrar em loop. */
let reporting = false;

/** StrictMode em dev monta o efeito duas vezes — sem isto, console.error seria
 * embrulhado em cima do proprio wrap. */
let installed = false;

function shouldSend(key: string, now: number): boolean {
  const previous = lastSentAt.get(key);
  if (previous !== undefined && now - previous < DEDUPE_WINDOW_MS) return false;

  lastSentAt.set(key, now);
  // Sessao longa nao pode fazer o mapa crescer sem limite.
  for (const [seen, at] of lastSentAt) {
    if (now - at > DEDUPE_WINDOW_MS) lastSentAt.delete(seen);
  }
  return true;
}

/** Descreve um argumento de console.error SEM serializar objeto arbitrario
 * (que poderia conter dado pessoal): string vai como esta', Error vira a
 * mensagem, o resto vira so' o nome do tipo. */
function describeValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  if (value === null) return "null";
  if (typeof value === "object") return `[${value.constructor?.name ?? "object"}]`;
  return `[${typeof value}]`;
}

function report(type: ClientErrorType, message: string, stack?: string): void {
  if (reporting) return;

  const trimmed = message.slice(0, MAX_MESSAGE_LENGTH).trim();
  if (!trimmed) return;

  const now = Date.now();
  if (!shouldSend(`${type}:${trimmed}`, now)) return;

  // SO' o pathname: a querystring pode carregar token/erro com dado pessoal.
  const route = window.location.pathname;
  const payload: ClientErrorPayload = {
    message: trimmed,
    type,
    route,
    userAgent: navigator.userAgent,
    timestamp: new Date(now).toISOString(),
  };
  if (stack) payload.stack = stack.slice(0, MAX_STACK_LENGTH);
  const tenantSlug = extractTenantSlug(route);
  if (tenantSlug) payload.tenantSlug = tenantSlug;

  reporting = true;
  try {
    void fetch(CLIENT_ERROR_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // keepalive: o envio sobrevive a navegacao/fechamento da aba — o erro
      // que mata a pagina e' justamente o que mais interessa capturar.
      keepalive: true,
      // Sem cookie: o endpoint nao autentica e nao deve receber a sessao.
      credentials: "omit",
    }).catch(() => {
      // Reporter nunca pode quebrar a app nem gerar novo erro nao tratado.
    });
  } catch {
    // idem (fetch indisponivel/bloqueado).
  } finally {
    reporting = false;
  }
}

function handleError(event: ErrorEvent): void {
  // NUNCA ler event.target: num erro de recurso ele e' o elemento (podendo ser
  // um <input> com dado digitado).
  const origin = event.filename ? ` (${event.filename}:${event.lineno}:${event.colno})` : "";
  const message = event.message || describeValue(event.error);
  report("error", `${message}${origin}`, event.error instanceof Error ? event.error.stack : undefined);
}

function handleRejection(event: PromiseRejectionEvent): void {
  const reason: unknown = event.reason;
  report(
    "unhandledrejection",
    describeValue(reason),
    reason instanceof Error ? reason.stack : undefined,
  );
}

function wrapConsoleError(): void {
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    original(...args);
    // React reporta erro de hidratacao por console.error — capturar isto e' o
    // ponto alto do INC, porque hidratacao quebrada mata todo onClick da tela
    // sem lancar nada que os outros listeners peguem.
    const stack = args.find((arg): arg is Error => arg instanceof Error)?.stack;
    report("console_error", args.map(describeValue).join(" "), stack);
  };
}

/** Idempotente. Chamado SO' depois de a flag ser confirmada pelo chamador. */
export function setupClientErrorReporter(): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleRejection);
  wrapConsoleError();
}

/** Hook do error boundary de rota (src/app/error.tsx). O digest entra na
 * mensagem para casar a linha do client com o log do servidor. */
export function reportBoundaryError(error: Error & { digest?: string }): void {
  const message = error.digest ? `${error.message} [digest ${error.digest}]` : error.message;
  report("boundary", message || "erro sem mensagem", error.stack);
}
