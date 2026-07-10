import { PrismaClient } from "@prisma/client";
import { ensureAppRolePassword } from "../prisma/db-admin";

// Roda UMA vez antes de todos os arquivos de teste (globalSetup do vitest,
// nao um beforeAll por arquivo). Antes disso, cada arquivo de teste de
// integracao chamava ensureAppRolePassword no proprio beforeAll — com dois
// ou mais arquivos rodando em paralelo (vitest roda arquivos em paralelo por
// padrao), os dois ALTER ROLE concorrentes na mesma role batiam de frente
// (Postgres: "tuple concurrently updated"). Centralizar aqui elimina a
// corrida por construcao, em vez de serializar os arquivos de teste.
export default async function setup() {
  const db = new PrismaClient();
  try {
    await ensureAppRolePassword(db);
  } finally {
    await db.$disconnect();
  }
}
