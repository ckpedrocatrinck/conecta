import type { NextAuthConfig } from "next-auth";

// Parte edge-safe da config do Auth.js (ADR-007): SEM providers, SEM
// import de node:crypto/Prisma. middleware.ts importa SO' este arquivo —
// Next.js roda middleware no Edge Runtime por padrao, que nao suporta
// modulos nativos do Node (o Credentials provider usa hashCpf/withTenant,
// que usam node:crypto e uma conexao Postgres direta, nenhum dos dois
// edge-compativel). src/lib/auth/config.ts (Node-only) espalha esta config
// e adiciona o provider de verdade.
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
        token.tenantId = user.tenantId;
        token.role = user.role;
        token.sessionId = user.sessionId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.tenantId = token.tenantId;
      session.user.role = token.role;
      session.user.sessionId = token.sessionId;
      return session;
    },
  },
};
