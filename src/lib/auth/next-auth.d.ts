import type { UserRole } from "@prisma/client";

// Augmenta os tipos do Auth.js com os campos que o nosso authorize()/jwt()
// carregam (ADR-007: sessionId e' o ponteiro para a tabela Session).
declare module "next-auth" {
  interface User {
    tenantId: string;
    tenantSlug: string;
    role: UserRole;
    sessionId: string;
  }

  interface Session {
    user: {
      id: string;
      tenantId: string;
      tenantSlug: string;
      role: UserRole;
      sessionId: string;
    };
  }
}

// "next-auth/jwt" so' re-exporta o tipo JWT declarado em "@auth/core/jwt"
// (`export * from`) — augmentar o modulo de re-export nao mescla no tipo de
// verdade (por isso token.campo lia como `unknown`, herdado do
// `Record<string, unknown>` que @auth/core/jwt.JWT extende). O alvo certo
// da declaration merging e' o modulo onde a interface nasce.
declare module "@auth/core/jwt" {
  interface JWT {
    userId: string;
    tenantId: string;
    tenantSlug: string;
    role: UserRole;
    sessionId: string;
  }
}
