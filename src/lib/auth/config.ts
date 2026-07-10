import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { hashCpf } from "../crypto/cpf-hash";
import { verifyPassword } from "../crypto/password-hash";
import { withTenant } from "../db/with-tenant";
import { createSession, revokeSession } from "../repositories/session.repository";
import { findActiveTenantBySlug } from "../repositories/tenant.repository";
import { findUserByCpfHash, registerFailedLogin, registerSuccessfulLogin } from "../repositories/user.repository";

// Duracao de sessao (JWT + linha em `Session`, ADR-007). 12h cobre um turno
// de trabalho sem forcar novo login no meio do expediente.
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        tenantSlug: { label: "Empresa" },
        cpf: { label: "CPF" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const tenantSlug = typeof credentials?.tenantSlug === "string" ? credentials.tenantSlug : "";
        const cpf = typeof credentials?.cpf === "string" ? credentials.cpf : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!tenantSlug || !cpf || !password) return null;

        // Erro sempre generico daqui pra baixo — nunca revelar se o CPF ou
        // a empresa existem (LGPD: minimizar o que um atacante aprende).
        const tenant = await findActiveTenantBySlug(tenantSlug);
        if (!tenant) return null;

        const cpfHash = hashCpf(cpf);

        return withTenant({ tenantId: tenant.id }, async (tx) => {
          const user = await findUserByCpfHash(tx, tenant.id, cpfHash);
          if (!user || user.status !== "active") return null;
          if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) return null;

          const validPassword = await verifyPassword(password, user.passwordHash);
          if (!validPassword) {
            await registerFailedLogin(tx, user.id, user.failedLoginAttempts);
            return null;
          }

          await registerSuccessfulLogin(tx, user.id);
          const session = await createSession(tx, {
            tenantId: tenant.id,
            userId: user.id,
            expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
          });

          return {
            id: user.id,
            tenantId: tenant.id,
            role: user.role,
            sessionId: session.id,
          };
        });
      },
    }),
  ],
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
  events: {
    // Revoga a linha em `Session` no logout — o que torna "logout invalida
    // de verdade" (LGPD/ADR-006) real, nao so' o cookie sendo limpo no
    // cliente (ADR-007).
    async signOut(message) {
      if (!("token" in message) || !message.token) return;
      const { tenantId, sessionId } = message.token;
      if (!tenantId || !sessionId) return;
      await withTenant({ tenantId }, (tx) => revokeSession(tx, sessionId));
    },
  },
});
