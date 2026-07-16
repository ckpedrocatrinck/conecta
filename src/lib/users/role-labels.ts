import type { UserRole } from "@prisma/client";

// R18 (auditoria de usabilidade 2026-07): user.role aparecia cru em ingles
// minusculo ("employee"/"manager"/"admin") na lista de colaboradores,
// enquanto os <select> de edicao ja usam estes mesmos rotulos pt-BR.
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  employee: "Colaborador",
  manager: "Gestor",
  admin: "Admin",
};
