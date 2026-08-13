import { PrismaClient } from "@prisma/client";
import { ensureAppRolePassword } from "./db-admin";
import { buildTenantFixtures } from "./seed-data";

// Segundo tenant de desenvolvimento, para o QA de isolamento cross-tenant do
// INC-014 (logar num tenant e tentar a URL do outro). Idempotente: pula se ja
// existe. Usa a role owner (bypassa RLS de proposito — operacao administrativa,
// como o seed principal). NUNCA rodar em producao.
const TENANT_B_ID = "00000000-0000-4000-8000-0000000000b2";
const ADMIN_B_ID = "00000000-0000-4000-8000-0000000000b1";
const CPF_OFFSET_B = 500; // CPFs de B nao colidem com o tenant A (offset 0)

const db = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("prisma/seed-dev-tenant-b.ts e' seed de DEV — nunca rodar com NODE_ENV=production.");
  }

  await ensureAppRolePassword(db);

  const existing = await db.tenant.findUnique({ where: { id: TENANT_B_ID } });
  if (existing) {
    console.log(`Tenant B "${existing.name}" (${existing.slug}) ja existe — pulando.`);
    return;
  }

  const { tenant, users } = await buildTenantFixtures(db, {
    id: TENANT_B_ID,
    adminUserId: ADMIN_B_ID,
    name: "Tere Frutas",
    slug: "tere-frutas",
    branchCount: 2,
    userCount: 8,
    cpfSeedOffset: CPF_OFFSET_B,
  });

  const adminCpf = String(10_000_000_000 + CPF_OFFSET_B * 1000 + 0).padStart(11, "0");
  console.log(`Tenant B "${tenant.name}" (slug=${tenant.slug}) com ${users.length} usuarios.`);
  console.log(`Admin B -> CPF ${adminCpf} / senha Trocar123!`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
