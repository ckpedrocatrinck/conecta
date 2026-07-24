import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
//
// Tenant MINIMO de proposito (so' a linha em tenants, sem users/posts): o alvo
// e' a escrita em `tenants`; construir fixture completo so' adicionaria
// contencao de DB ao rodar em paralelo com os outros arquivos de integracao.
const ownerDb = new PrismaClient();

let tenantId: string;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  const tenant = await ownerDb.tenant.create({
    data: { name: `Appearance Test ${suffix}`, slug: `appearance-test-${suffix}` },
  });
  tenantId = tenant.id;
}, 30_000);

afterAll(async () => {
  await cleanupTenant(ownerDb, tenantId);
  await ownerDb.$disconnect();
});

describe("updateTenantAppearance — escrita em tenants sob conecta_app (INC-017)", () => {
  it("grava banner, logo e cor de uma vez (os tres campos)", async () => {
    const bannerKey = `branding/${tenantId}/banner/${randomUUID()}`;
    const logoKey = `branding/${tenantId}/logo/${randomUUID()}`;

    await withTenant({ tenantId }, (tx) =>
      updateTenantAppearance(tx, tenantId, {
        homeBannerKey: bannerKey,
        logoUrl: logoKey,
        accentColor: "#123abc",
      }),
    );

    const branding = await findTenantBranding(tenantId);
    const storedBanner = await findTenantHomeBannerKey(tenantId);
    expect(storedBanner).toBe(bannerKey);
    expect(branding.logoUrl).toBe(logoKey);
    expect(branding.accentColor).toBe("#123abc");
  });

  it("atualizacao parcial: so' a cor muda, banner/logo permanecem", async () => {
    const before = await findTenantHomeBannerKey(tenantId);

    await withTenant({ tenantId }, (tx) =>
      updateTenantAppearance(tx, tenantId, { accentColor: "#00ff00" }),
    );

    const branding = await findTenantBranding(tenantId);
    const banner = await findTenantHomeBannerKey(tenantId);
    expect(branding.accentColor).toBe("#00ff00");
    // homeBannerKey nao foi passado => intacto (undefined nao apaga).
    expect(banner).toBe(before);
  });
});
