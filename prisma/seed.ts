import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { DEV_ADMIN_USER_ID, DEV_TENANT_ID } from "../src/lib/dev/seed-ids";
import { ensureAppRolePassword } from "./db-admin";
import { buildTenantFixtures } from "./seed-data";
import { seedDemoAnnouncements, seedTenantLogo } from "./seed-demo-content";

// Usa DATABASE_URL (role owner do docker-compose) — bypassa RLS de
// proposito, seed e' operacao administrativa.
const db = new PrismaClient();

const BRANCH_NAMES = ["Centro", "Zona Norte", "Distrito Industrial"];
const USER_COUNT = 40;
const CPF_OFFSET = 0;

/** Mesma formula de seed-data.ts (buildTenantFixtures) — reproduzida aqui so'
 * para IMPRIMIR a credencial de demonstracao (o CPF em claro nunca e'
 * persistido nem devolvido pelo Prisma, so' o hash). */
function demoCpf(index: number): string {
  return String(10_000_000_000 + CPF_OFFSET * 1000 + index).padStart(11, "0");
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("prisma/seed.ts e' seed de DEMONSTRACAO — nunca rodar com NODE_ENV=production.");
  }

  await ensureAppRolePassword(db);
  console.log("Senha da role conecta_app atualizada a partir de APP_DB_PASSWORD.");

  const existing = await db.tenant.findUnique({ where: { id: DEV_TENANT_ID } });
  if (existing) {
    console.log(`Tenant de dev "${existing.name}" ja existe (id=${existing.id}) — pulando seed de dados.`);
    return;
  }

  const { tenant, branches, users } = await buildTenantFixtures(db, {
    id: DEV_TENANT_ID,
    adminUserId: DEV_ADMIN_USER_ID,
    name: "Rede Vale Verde",
    slug: "vale-verde",
    branchCount: BRANCH_NAMES.length,
    branchNames: BRANCH_NAMES,
    userCount: USER_COUNT,
    cpfSeedOffset: CPF_OFFSET,
    includeSampleAnnouncements: false,
  });

  const admin = users[0];
  const manager = users[1];
  const employee = users[4];

  const announcementResults = await seedDemoAnnouncements(db, {
    tenantId: tenant.id,
    adminId: admin.id,
    branches,
    users,
  });

  const logoPath = path.resolve(process.cwd(), "public/branding/logo.png");
  await seedTenantLogo(db, tenant.id, logoPath);

  console.log(`Seed concluido: tenant "${tenant.name}" (${tenant.id}) com ${users.length} usuarios.`);
  console.log(`Comunicados: ${announcementResults.length} criados.`);
  for (const r of announcementResults) {
    const pct = r.percentConfirmed !== undefined ? ` — ${r.percentConfirmed}% confirmado` : "";
    console.log(`  [${r.status}] ${r.title}${pct}`);
  }
  console.log("Logo do tenant enviado para o media storage local.");
  console.log("");
  console.log("Credenciais de demonstracao (senha inicial igual para todos, troca obrigatoria no 1o login):");
  console.log(`  Admin      — CPF ${demoCpf(0)} / senha Trocar123!  (${admin.fullName})`);
  console.log(`  Gestor     — CPF ${demoCpf(1)} / senha Trocar123!  (${manager.fullName})`);
  console.log(`  Colaborador— CPF ${demoCpf(4)} / senha Trocar123!  (${employee.fullName})`);
  console.log(`  Acesse em /vale-verde/login`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
