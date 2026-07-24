import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { cleanupTenant } from "../helpers/cleanup-tenant";
import { withTenant } from "../../src/lib/db/with-tenant";
import {
  findTenantBranding,
  findTenantHomeBannerKey,
  updateTenantAppearance,
} from "../../src/lib/repositories/tenant.repository";

// INC-017: a tela "Aparencia da empresa" e' a PRIMEIRA escrita da app em
// `tenants`. Ate aqui conecta_app so' tinha SELECT nessa tabela — o UPDATE
// falhava com 42501 (permission denied). Estes testes rodam sob o role real da
// app (withTenant => conecta_app) e provam que o GRANT UPDATE (migration
// inc017_grant_update_tenants) libera as tres gravacoes; teriam falhado antes.
const ownerDb = new PrismaClient();

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Appearance Test ${suffix}`,
    slug: `appearance-test-${suffix}`,
    branchCount: 1,
    userCount: 6,
    cpfSeedOffset: 660,
  });
}, 60_000);

afterAll(async () => {
  await cleanupTenant(ownerDb, tenant.tenant.id);
  await ownerDb.$disconnect();
});

describe("updateTenantAppearance — escrita em tenants sob conecta_app (INC-017)", () => {
  it("grava banner, logo e cor de uma vez (os tres campos)", async () => {
    const id = tenant.tenant.id;
    const bannerKey = `branding/${id}/banner/${randomUUID()}`;
    const logoKey = `branding/${id}/logo/${randomUUID()}`;

    await withTenant({ tenantId: id }, (tx) =>
      updateTenantAppearance(tx, id, {
        homeBannerKey: bannerKey,
        logoUrl: logoKey,
        accentColor: "#123abc",
      }),
    );

    const branding = await findTenantBranding(id);
    const storedBanner = await findTenantHomeBannerKey(id);
    expect(storedBanner).toBe(bannerKey);
    expect(branding.logoUrl).toBe(logoKey);
    expect(branding.accentColor).toBe("#123abc");
  });

  it("atualizacao parcial: so' a cor muda, banner/logo permanecem", async () => {
    const id = tenant.tenant.id;
    const before = await findTenantHomeBannerKey(id);

    await withTenant({ tenantId: id }, (tx) =>
      updateTenantAppearance(tx, id, { accentColor: "#00ff00" }),
    );

    const branding = await findTenantBranding(id);
    const banner = await findTenantHomeBannerKey(id);
    expect(branding.accentColor).toBe("#00ff00");
    // homeBannerKey nao foi passado => intacto (undefined nao apaga).
    expect(banner).toBe(before);
  });
});
