// IDs fixos do tenant/usuario de desenvolvimento semeados por
// prisma/seed.ts — usados por src/lib/dev/fake-context.ts para simular um
// usuario autenticado enquanto o INC-003 nao existe. NUNCA usar em produção
// (fake-context.ts tem guard explicito para isso).

export const DEV_TENANT_ID = "00000000-0000-4000-8000-000000000001";
export const DEV_ADMIN_USER_ID = "00000000-0000-4000-8000-0000000000a1";
