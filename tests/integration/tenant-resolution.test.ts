import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { cleanupTenant } from "../helpers/cleanup-tenant";
import { resolveTenantBySlug } from "../../src/lib/tenant/resolve-tenant";

// INC-014 Bloco 1 — resolucao autoritativa slug -> tenant (camada Node).
// Prova: slug ativo resolve; slug inexistente -> null (o boundary [slug]
// converte em 404 sem vazar lista); tenant inativo -> null (nao vaza cliente
// desativado). Role owner so' para montar/derrubar as fixtures; a resolucao em
// si roda pelo appDb (conecta_app), como em producao.
const ownerDb = new PrismaClient();

let active: Awaited<ReturnType<typeof buildTenantFixtures>>;
let inactive: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  active = await buildTenantFixtures(ownerDb, {
    name: `Resolution Active ${suffix}`,
    slug: `resolution-active-${suffix}`,
    branchCount: 1,
    userCount: 6,
    cpfSeedOffset: 301,
  });
  inactive = await buildTenantFixtures(ownerDb, {
    name: `Resolution Inactive ${suffix}`,
    slug: `resolution-inactive-${suffix}`,
    branchCount: 1,
    userCount: 6,
    cpfSeedOffset: 302,
  });
  await ownerDb.tenant.update({ where: { id: inactive.tenant.id }, data: { status: "inactive" } });
}, 60_000);

afterAll(async () => {
  await cleanupTenant(ownerDb, active.tenant.id);
  await cleanupTenant(ownerDb, inactive.tenant.id);
  await ownerDb.$disconnect();
});

describe("resolveTenantBySlug", () => {
  it("resolve um slug de tenant ativo para {id, slug, name}", async () => {
    const resolved = await resolveTenantBySlug(active.tenant.slug);
    expect(resolved).toEqual({
      id: active.tenant.id,
      slug: active.tenant.slug,
      name: active.tenant.name,
    });
  });

  it("retorna null para slug inexistente (o boundary vira 404 sem vazar lista)", async () => {
    const resolved = await resolveTenantBySlug(`nao-existe-${randomUUID().slice(0, 8)}`);
    expect(resolved).toBeNull();
  });

  it("retorna null para tenant inativo (nao vaza cliente desativado)", async () => {
    const resolved = await resolveTenantBySlug(inactive.tenant.slug);
    expect(resolved).toBeNull();
  });
});
