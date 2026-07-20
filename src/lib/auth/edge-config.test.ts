import { describe, expect, it } from "vitest";
import { authConfig } from "./edge-config";

// INC-014 Bloco 2: o tenantSlug precisa viajar no JWT e reaparecer na Session —
// e' o que o compare LEVE do middleware Edge (Bloco 3) vai ler sem tocar banco.
// Callbacks sao funcoes puras (sem Prisma/rede), entao testam-se direto.

const jwt = authConfig.callbacks!.jwt!;
const session = authConfig.callbacks!.session!;

// Os params das callbacks do Auth.js sao unioes complexas (JWT | User |
// AdapterUser…); montar o objeto completo nao agrega ao que se prova aqui. O
// cast localizado via Parameters<> evita `any` e mantem o teste focado.
type JwtArgs = Parameters<typeof jwt>[0];
type SessionArgs = Parameters<typeof session>[0];

describe("edge-config callbacks — tenantSlug no JWT (INC-014 Bloco 2)", () => {
  it("jwt copia tenantSlug e demais campos do user no login", async () => {
    const token = await jwt({
      token: {},
      user: { id: "u1", tenantId: "t1", tenantSlug: "valeverde", role: "employee", sessionId: "s1" },
    } as unknown as JwtArgs);

    expect(token).not.toBeNull();
    expect(token!.tenantSlug).toBe("valeverde");
    expect(token!.tenantId).toBe("t1");
    expect(token!.userId).toBe("u1");
    expect(token!.sessionId).toBe("s1");
  });

  it("jwt sem user (refresh do token) preserva o tenantSlug ja existente", async () => {
    const existing = { userId: "u1", tenantId: "t1", tenantSlug: "valeverde", role: "employee", sessionId: "s1" };
    const token = await jwt({ token: existing } as unknown as JwtArgs);
    expect(token!.tenantSlug).toBe("valeverde");
  });

  it("session expoe o tenantSlug do token para o cliente/servidor", async () => {
    const result = await session({
      session: { user: {} },
      token: { userId: "u1", tenantId: "t1", tenantSlug: "valeverde", role: "employee", sessionId: "s1" },
    } as unknown as SessionArgs);

    expect(result.user!.tenantSlug).toBe("valeverde");
    expect(result.user!.tenantId).toBe("t1");
  });
});
