import { PrismaClient } from "@prisma/client";
import { DEV_ADMIN_USER_ID, DEV_TENANT_ID } from "../src/lib/dev/seed-ids";
import { ensureAppRolePassword } from "./db-admin";
import { buildTenantFixtures } from "./seed-data";

// Usa DATABASE_URL (role owner do docker-compose) — bypassa RLS de
// proposito, seed e' operacao administrativa.
const db = new PrismaClient();

async function main() {
  await ensureAppRolePassword(db);
  console.log("Senha da role conecta_app atualizada a partir de APP_DB_PASSWORD.");

  const existing = await db.tenant.findUnique({ where: { id: DEV_TENANT_ID } });
  if (existing) {
    console.log(`Tenant de dev "${existing.name}" ja existe (id=${existing.id}) — pulando seed de dados.`);
    return;
  }

  const { tenant, users } = await buildTenantFixtures(db, {
    id: DEV_TENANT_ID,
    adminUserId: DEV_ADMIN_USER_ID,
    name: "Rede Vale Verde",
    slug: "vale-verde",
    branchCount: 3,
    userCount: 30,
  });

  console.log(`Seed concluido: tenant "${tenant.name}" (${tenant.id}) com ${users.length} usuarios.`);
  console.log(`Contexto fake de dev: tenant=${tenant.id}, admin=${users[0].id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
