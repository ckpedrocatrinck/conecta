import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimitStore } from "@/lib/security/rate-limit";
import { CLIENT_ERROR_LOG_PREFIX, MAX_PAYLOAD_BYTES } from "@/lib/debug/client-error-contract";
import { POST } from "./route";

// Contrato do coletor do INC-022. O que importa aqui e' o que NAO passa:
// campo fora do schema, payload gigante, excesso de requests — e o que nunca
// aparece no log (querystring, IP).

const VALID = {
  message: "Cannot read properties of undefined (reading 'map')",
  stack: "TypeError: ...\n    at ReactionButton",
  type: "error",
  route: "/vale-verde",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X)",
  tenantSlug: "vale-verde",
  timestamp: "2026-08-04T12:00:00.000Z",
};

/** Cada teste usa um IP proprio: o limiter e' um Map de modulo, compartilhado. */
function request(body: unknown, ip: string, rawBody?: string): Request {
  return new Request("http://localhost/api/debug/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: rawBody ?? JSON.stringify(body),
  });
}

describe("POST /api/debug/client-error", () => {
  let stdout: string[];

  const loggedLines = () => stdout.filter((line) => line.startsWith(CLIENT_ERROR_LOG_PREFIX));

  beforeEach(() => {
    __resetRateLimitStore();
    stdout = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      stdout.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aceita payload valido e loga uma linha JSON prefixada", async () => {
    const response = await POST(request(VALID, "10.0.0.1"));

    expect(response.status).toBe(204);
    const lines = loggedLines();
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!.slice(CLIENT_ERROR_LOG_PREFIX.length))).toEqual(VALID);
  });

  it("aceita payload sem os campos opcionais", async () => {
    const minimal = {
      message: VALID.message,
      type: VALID.type,
      route: "/login",
      userAgent: VALID.userAgent,
      timestamp: VALID.timestamp,
    };
    const response = await POST(request(minimal, "10.0.0.2"));

    expect(response.status).toBe(204);
    expect(loggedLines()).toHaveLength(1);
  });

  it("rejeita campo fora do schema sem logar nada", async () => {
    const response = await POST(request({ ...VALID, cpf: "12345678901" }, "10.0.0.3"));

    expect(response.status).toBe(400);
    expect(loggedLines()).toHaveLength(0);
  });

  it("rejeita type desconhecido, message vazia, message acima do limite e timestamp invalido", async () => {
    const cases = [
      { ...VALID, type: "custom" },
      { ...VALID, message: "" },
      { ...VALID, message: "x".repeat(501) },
      { ...VALID, timestamp: "ontem" },
      { ...VALID, stack: "x".repeat(4001) },
    ];

    for (const [index, body] of cases.entries()) {
      const response = await POST(request(body, `10.0.1.${index}`));
      expect(response.status).toBe(400);
    }
    expect(loggedLines()).toHaveLength(0);
  });

  it("rejeita JSON malformado e corpo que nao e' objeto", async () => {
    expect((await POST(request(null, "10.0.2.1", "{nao-json"))).status).toBe(400);
    expect((await POST(request([VALID], "10.0.2.2"))).status).toBe(400);
    expect((await POST(request("texto solto", "10.0.2.3"))).status).toBe(400);
    expect(loggedLines()).toHaveLength(0);
  });

  it("devolve 413 e NAO loga quando o payload passa de 8KB", async () => {
    // stack dentro do limite do schema, mas o corpo inteiro estoura o teto.
    const oversized = JSON.stringify({ ...VALID, stack: "x".repeat(MAX_PAYLOAD_BYTES) });
    const response = await POST(request(null, "10.0.3.1", oversized));

    expect(response.status).toBe(413);
    expect(loggedLines()).toHaveLength(0);
  });

  it("descarta a querystring da rota, mesmo se o cliente mandar", async () => {
    const response = await POST(
      request({ ...VALID, route: "/vale-verde/perfil?token=abc123&erro=senha" }, "10.0.4.1"),
    );

    expect(response.status).toBe(204);
    const logged = JSON.parse(loggedLines()[0]!.slice(CLIENT_ERROR_LOG_PREFIX.length));
    expect(logged.route).toBe("/vale-verde/perfil");
    expect(loggedLines()[0]).not.toContain("token");
  });

  it("nunca escreve o IP na linha de log", async () => {
    await POST(request(VALID, "203.0.113.42"));

    expect(loggedLines()[0]).not.toContain("203.0.113.42");
  });

  it("aplica rate limit por IP e nao afeta outro IP", async () => {
    for (let i = 0; i < 20; i++) {
      expect((await POST(request(VALID, "10.0.5.1"))).status).toBe(204);
    }

    expect((await POST(request(VALID, "10.0.5.1"))).status).toBe(429);
    expect((await POST(request(VALID, "10.0.5.2"))).status).toBe(204);
  });

  it("conta requests invalidas no rate limit (nao da' cota infinita a lixo)", async () => {
    for (let i = 0; i < 20; i++) {
      expect((await POST(request({ ...VALID, type: "custom" }, "10.0.6.1"))).status).toBe(400);
    }

    expect((await POST(request(VALID, "10.0.6.1"))).status).toBe(429);
  });
});
