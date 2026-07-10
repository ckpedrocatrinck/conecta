import { DEV_ADMIN_USER_ID, DEV_TENANT_ID } from "./seed-ids";

export type RequestContext = {
  tenantId: string;
  userId: string;
  role: "admin";
};

/**
 * Contexto fake de dev — substitui a sessao autenticada enquanto o INC-003
 * nao existe. So' funciona fora de producao (guard abaixo) e so' deve ser
 * usado por paginas/rotas ainda sem auth real. Nenhuma rota deve aceitar
 * tenantId vindo do cliente (regra 7 do CLAUDE.md) — este e' o unico lugar
 * que decide "quem esta logado" ate' o INC-003 trocar por sessao real.
 */
export function getDevRequestContext(): RequestContext {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "getDevRequestContext() nao pode rodar em produção — INC-003 deve substituir por sessão real antes do go-live.",
    );
  }

  return {
    tenantId: DEV_TENANT_ID,
    userId: DEV_ADMIN_USER_ID,
    role: "admin",
  };
}
