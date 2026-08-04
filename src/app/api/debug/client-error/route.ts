import { NextResponse } from "next/server";
import {
  CLIENT_ERROR_LOG_PREFIX,
  CLIENT_ERROR_TYPES,
  MAX_MESSAGE_LENGTH,
  MAX_PAYLOAD_BYTES,
  MAX_ROUTE_LENGTH,
  MAX_STACK_LENGTH,
  MAX_TENANT_SLUG_LENGTH,
  MAX_USER_AGENT_LENGTH,
  type ClientErrorPayload,
  type ClientErrorType,
} from "@/lib/debug/client-error-contract";
import { isRateLimited, recordAttempt, type RateLimitOptions } from "@/lib/security/rate-limit";

// Coletor do reporter de erro client-side (INC-022). Instrumentacao TEMPORARIA
// de depuracao: o destino e' uma linha em stdout, NUNCA o banco.
//
// Sem autenticacao de proposito — o erro pode acontecer antes do login (tela de
// login/hidratacao), e um 401 aqui apagaria justamente o caso que se quer ver.
// O middleware ja deixa /api/** passar sem sessao (segmento reservado em
// slug-path.ts -> extractTenantSlug null -> forward em middleware.ts), entao
// nada precisa mudar em PUBLIC_PATHS.
//
// A superficie que isso abre e' um endpoint que escreve em log: contida por
// (1) rate limit por IP, (2) teto de 8KB, (3) schema fixo com rejeicao de
// qualquer chave desconhecida. Sem efeito colateral alem da linha de log.

// Toda request conta (diferente do login, que so' conta FALHA): aqui nao existe
// uso legitimo de alto volume — um device com a flag ligada manda um punhado de
// linhas por sessao, e o dedupe do cliente ja segura erro em loop.
const RATE_LIMIT: RateLimitOptions = { limit: 20, windowMs: 60 * 1000 };

const ALLOWED_KEYS = new Set([
  "message",
  "stack",
  "type",
  "route",
  "userAgent",
  "tenantSlug",
  "timestamp",
]);

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Descarta querystring/hash — o cliente ja manda so' o pathname, mas o servidor
 * nao confia nele: a query pode carregar token ou dado pessoal. */
function stripQuery(route: string): string {
  const cut = route.search(/[?#]/);
  return cut === -1 ? route : route.slice(0, cut);
}

function isKnownType(value: unknown): value is ClientErrorType {
  return typeof value === "string" && (CLIENT_ERROR_TYPES as readonly string[]).includes(value);
}

/** Schema FIXO: qualquer chave fora da lista invalida o payload inteiro (nao e'
 * "ignora o extra" — e' 400). Devolve null quando invalido. */
function parsePayload(input: unknown): ClientErrorPayload | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;

  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_KEYS.has(key)) return null;
  }

  const { message, stack, type, route, userAgent, tenantSlug, timestamp } = record;

  if (typeof message !== "string" || message.length === 0 || message.length > MAX_MESSAGE_LENGTH) return null;
  if (stack !== undefined && (typeof stack !== "string" || stack.length > MAX_STACK_LENGTH)) return null;
  if (!isKnownType(type)) return null;
  if (typeof route !== "string" || route.length === 0) return null;
  if (typeof userAgent !== "string") return null;
  if (tenantSlug !== undefined && typeof tenantSlug !== "string") return null;
  if (typeof timestamp !== "string" || Number.isNaN(Date.parse(timestamp))) return null;

  const payload: ClientErrorPayload = {
    message,
    type,
    route: stripQuery(route).slice(0, MAX_ROUTE_LENGTH),
    userAgent: userAgent.slice(0, MAX_USER_AGENT_LENGTH),
    timestamp,
  };
  if (stack) payload.stack = stack;
  if (tenantSlug) payload.tenantSlug = tenantSlug.slice(0, MAX_TENANT_SLUG_LENGTH);
  return payload;
}

export async function POST(request: Request) {
  const rateKey = `debug-client-error:${getClientIp(request)}`;
  if (isRateLimited(rateKey, RATE_LIMIT)) return new NextResponse(null, { status: 429 });
  recordAttempt(rateKey, RATE_LIMIT);

  // Teto de tamanho ANTES de qualquer log — 413 nao registra nada.
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PAYLOAD_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_PAYLOAD_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const payload = parsePayload(parsed);
  if (!payload) return new NextResponse(null, { status: 400 });

  // Uma linha JSON em stdout: `docker compose logs app | grep CLIENT_ERROR`.
  // O IP entra no rate limit mas NAO no log (dado pessoal, LGPD).
  console.log(`${CLIENT_ERROR_LOG_PREFIX} ${JSON.stringify(payload)}`);

  return new NextResponse(null, { status: 204 });
}
