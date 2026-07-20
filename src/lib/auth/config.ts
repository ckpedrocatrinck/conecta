import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { hashCpf } from "../crypto/cpf-hash";
import { verifyPassword } from "../crypto/password-hash";
import { withTenant } from "../db/with-tenant";
import { createSession, revokeSession } from "../repositories/session.repository";
import { findActiveTenantBySlug } from "../repositories/tenant.repository";
import { findUserByCpfHash, registerFailedLogin, registerSuccessfulLogin } from "../repositories/user.repository";
import { authConfig, SESSION_MAX_AGE_SECONDS } from "./edge-config";

// Config completa (Node-only) — usada pelo route handler e por Server
// Components/Actions, nunca pelo middleware (ver edge-config.ts). Reexporta
// SESSION_MAX_AGE_SECONDS so' para nao quebrar quem ja importava daqui.
export { SESSION_MAX_AGE_SECONDS };

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
            tenantSlug: tenant.slug,
            role: user.role,
            sessionId: session.id,
          };
        });
      },
    }),
  ],
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
