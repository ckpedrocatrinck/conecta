// Contrato do reporter de erro client-side (INC-022). Compartilhado entre o
// modulo do browser (que monta o payload) e o route handler (que valida) —
// mas o servidor NUNCA confia no cliente: revalida tudo em runtime, campo a
// campo, e rejeita qualquer chave fora desta lista.
//
// Instrumentacao TEMPORARIA de depuracao, nao observability permanente: nada
// aqui persiste em banco, o destino e' uma linha em stdout.

export const CLIENT_ERROR_ENDPOINT = "/api/debug/client-error";

/** Prefixo da linha de log — e' o que o `grep CLIENT_ERROR` do operador acha. */
export const CLIENT_ERROR_LOG_PREFIX = "[CLIENT_ERROR]";

// "handled": erro que um `catch` do produto JA' TRATOU. Nenhum listener global
// o veria — o catch engoliu a excecao antes de virar `error`/`unhandledrejection`.
// A procedencia (qual fluxo) vai no PREFIXO da mensagem, entre colchetes, no
// formato `push:activate`. (Escrito sem os colchetes literais de proposito: o
// scanner do Tailwind trata `[algo:valor]` como propriedade arbitraria e emite
// uma regra CSS morta no bundle, mesmo vindo de um comentario.)
// porque `route` e' derivada de `window.location.pathname` dentro do reporter e
// o call site nao a define. Acrescentado na instrumentacao temporaria do fluxo
// de push (INC-025); o servidor aceita automaticamente por validar contra esta
// mesma constante.
export const CLIENT_ERROR_TYPES = ["error", "unhandledrejection", "console_error", "boundary", "handled"] as const;
export type ClientErrorType = (typeof CLIENT_ERROR_TYPES)[number];

/** Schema FIXO. Nenhum campo livre, nenhuma extensao ad-hoc. */
export type ClientErrorPayload = {
  message: string;
  stack?: string;
  type: ClientErrorType;
  /** So' o pathname — nunca a querystring (pode carregar token/erro com dado). */
  route: string;
  userAgent: string;
  tenantSlug?: string;
  /** ISO 8601, gerado no device (o relogio do celular pode divergir do servidor). */
  timestamp: string;
};

export const MAX_MESSAGE_LENGTH = 500;
export const MAX_STACK_LENGTH = 4000;
export const MAX_PAYLOAD_BYTES = 8 * 1024;

// O INC fixa limite so' para message/stack. Para os demais campos o servidor
// TRUNCA em vez de rejeitar: um user-agent exotico e' ruido de log, nao um
// cliente malformado — rejeitar perderia o diagnostico que e' o objetivo do INC.
export const MAX_ROUTE_LENGTH = 200;
export const MAX_USER_AGENT_LENGTH = 300;
export const MAX_TENANT_SLUG_LENGTH = 64;
