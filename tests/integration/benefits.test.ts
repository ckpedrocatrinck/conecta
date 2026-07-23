import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { cleanupTenant } from "../helpers/cleanup-tenant";
import { withTenant } from "../../src/lib/db/with-tenant";
import {
  createBenefit,
  deleteBenefit,
  findActiveBenefitsForEmployee,
  findBenefitById,
  findBenefitsForAdminList,
  setBenefitActive,
  updateBenefitFields,
} from "../../src/lib/repositories/benefit.repository";

const ownerDb = new PrismaClient();

let tenantA: Awaited<ReturnType<typeof buildTenantFixtures>>;
let tenantB: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenantA = await buildTenantFixtures(ownerDb, {
    name: `Benefits Test A ${suffix}`,
    slug: `benefits-test-a-${suffix}`,
    branchCount: 1,
    userCount: 4,
    cpfSeedOffset: 610,
    includeSampleAnnouncements: false,
  });
  tenantB = await buildTenantFixtures(ownerDb, {
    name: `Benefits Test B ${suffix}`,
    slug: `benefits-test-b-${suffix}`,
    branchCount: 1,
    userCount: 4,
    cpfSeedOffset: 620,
    includeSampleAnnouncements: false,
  });
}, 60_000);

afterAll(async () => {
  await cleanupTenant(ownerDb, tenantA.tenant.id);
  await cleanupTenant(ownerDb, tenantB.tenant.id);
  await ownerDb.$disconnect();
});

function newBenefit(overrides: Partial<Parameters<typeof createBenefit>[1]> = {}) {
  return withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
    createBenefit(tx, {
      tenantId: tenantA.tenant.id,
      category: "saude",
      partnerName: "Parceiro Teste",
      title: "Beneficio de teste",
      description: "Descricao de teste",
      createdBy: tenantA.users[0].id,
      ...overrides,
    }),
  );
}

describe("CRUD de beneficios", () => {
  it("cria, edita, desativa/reativa e remove", async () => {
    const created = await newBenefit({ partnerName: "Academia X", title: "10% off" });
    expect(created.active).toBe(true);
    expect(created.logoUrl).toBeNull(); // MVP: sem logo

    // update
    await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      updateBenefitFields(tx, tenantA.tenant.id, created.id, {
        category: "lazer",
        partnerName: "Academia X Editada",
        title: "20% off",
        description: "Nova descricao",
        location: "Rua 1",
        contact: "(11) 90000-0000",
        sortOrder: 5,
      }),
    );
    const updated = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findBenefitById(tx, tenantA.tenant.id, created.id),
    );
    expect(updated?.category).toBe("lazer");
    expect(updated?.partnerName).toBe("Academia X Editada");
    expect(updated?.location).toBe("Rua 1");
    expect(updated?.sortOrder).toBe(5);

    // desativa
    await withTenant({ tenantId: tenantA.tenant.id }, (tx) => setBenefitActive(tx, tenantA.tenant.id, created.id, false));
    const deactivated = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findBenefitById(tx, tenantA.tenant.id, created.id),
    );
    expect(deactivated?.active).toBe(false);

    // reativa
    await withTenant({ tenantId: tenantA.tenant.id }, (tx) => setBenefitActive(tx, tenantA.tenant.id, created.id, true));
    const reactivated = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findBenefitById(tx, tenantA.tenant.id, created.id),
    );
    expect(reactivated?.active).toBe(true);

    // remove (hard delete)
    await withTenant({ tenantId: tenantA.tenant.id }, (tx) => deleteBenefit(tx, tenantA.tenant.id, created.id));
    const removed = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findBenefitById(tx, tenantA.tenant.id, created.id),
    );
    expect(removed).toBeNull();
  });
});

describe("colaborador ve so' active=true", () => {
  it("findActiveBenefitsForEmployee omite beneficios inativos", async () => {
    const activeOne = await newBenefit({ partnerName: "Visivel", title: "Ativo", category: "educacao" });
    const inactiveOne = await newBenefit({ partnerName: "Oculto", title: "Inativo", category: "educacao" });
    await withTenant({ tenantId: tenantA.tenant.id }, (tx) => setBenefitActive(tx, tenantA.tenant.id, inactiveOne.id, false));

    const visible = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findActiveBenefitsForEmployee(tx, tenantA.tenant.id),
    );
    const ids = visible.map((b) => b.id);
    expect(ids).toContain(activeOne.id);
    expect(ids).not.toContain(inactiveOne.id);
    expect(visible.every((b) => b.active)).toBe(true);
  });
});

describe("ordenacao dentro da categoria", () => {
  it("ordena por category, depois sortOrder, depois createdAt", async () => {
    // Duas categorias, sortOrder fora de ordem de criacao.
    const alimA = await newBenefit({ category: "alimentacao", partnerName: "Alim 2", title: "t", sortOrder: 2 });
    const alimB = await newBenefit({ category: "alimentacao", partnerName: "Alim 1", title: "t", sortOrder: 1 });
    const outros = await newBenefit({ category: "outros", partnerName: "Outro", title: "t", sortOrder: 1 });

    const list = await withTenant({ tenantId: tenantA.tenant.id }, (tx) => findBenefitsForAdminList(tx, tenantA.tenant.id));
    const relevant = list.filter((b) => [alimA.id, alimB.id, outros.id].includes(b.id));

    // alimentacao vem antes de outros; dentro de alimentacao, sortOrder 1 antes de 2.
    expect(relevant.map((b) => b.id)).toEqual([alimB.id, alimA.id, outros.id]);
  });
});

describe("isolamento multi-tenant", () => {
  it("tenant A nao encontra, por ID, um beneficio do tenant B", async () => {
    const targetId = tenantB.benefits[0].id;
    const result = await withTenant({ tenantId: tenantA.tenant.id }, (tx) => findBenefitById(tx, tenantA.tenant.id, targetId));
    expect(result).toBeNull();
  });

  it("tenant A nao consegue gravar beneficio com tenant_id de B estando no contexto de A (WITH CHECK)", async () => {
    await expect(
      withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
        tx.benefit.create({
          data: {
            tenantId: tenantB.tenant.id,
            category: "outros",
            partnerName: "Invasor",
            title: "nao deveria gravar",
            description: "x",
            createdBy: tenantB.users[0].id,
          },
        }),
      ),
    ).rejects.toThrow();
  });
});
