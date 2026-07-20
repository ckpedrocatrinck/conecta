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
        // tenantSlug viaja no JWT (assinado) para a checagem LEVE de vinculo no
        // middleware Edge (INC-014 Bloco 3): slug da URL x tenantSlug do token,
        // sem tocar banco. Nao e' a barreira — o Node revalida + RLS seguram.
        token.tenantSlug = user.tenantSlug;
        token.role = user.role;
        token.sessionId = user.sessionId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.tenantId = token.tenantId;
      session.user.tenantSlug = token.tenantSlug;
      session.user.role = token.role;
      session.user.sessionId = token.sessionId;
      return session;
    },
  },
};
