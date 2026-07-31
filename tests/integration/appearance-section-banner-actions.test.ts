import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { cleanupTenant } from "../helpers/cleanup-tenant";
import type { ActiveSession } from "../../src/lib/auth/session";
import { mediaStorage } from "../../src/lib/storage/media-storage";
import { deleteMediaFile, writeMediaFile } from "../../src/lib/storage/local-media-fs";
import {
  findTenantBeneficiosBannerKey,
  findTenantBranding,
  findTenantHomeBannerKey,
  findTenantVagasBannerKey,
} from "../../src/lib/repositories/tenant.repository";

/**
 * `confirmBrandingUploadAction` (tela "Aparencia da empresa") nunca teve teste
 * proprio, nem para banner/logo do INC-017 — lacuna encontrada no levantamento
 * que motivou este INC-019. Este arquivo fecha a lacuna para os 2 targets
 * novos (vagas-banner, beneficios-banner), no mesmo padrao de
 * announcement-create-actions.test.ts: `requireAdmin` trocado por um dublê
 * fixado numa sessao real, banco real.
 */

const sessionRef: { current: ActiveSession | null } = { current: null };

vi.mock("@/lib/auth/session", () => ({
  requireAdmin: async () => {
    if (!sessionRef.current) throw new Error("sessao de teste nao inicializada");
    return sessionRef.current;
  },
}));

const { confirmBrandingUploadAction } = await import(
  "../../src/app/[slug]/(app)/admin/aparencia/actions"
);

// Assinatura PNG (8 bytes) — o sniff decide o tipo so' pelo cabecalho (mesmos
// bytes de branding-display.test.ts).
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03]);

const ownerDb = new PrismaClient();
let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;
const writtenKeys: string[] = [];

async function writeBrandingObject(target: string): Promise<string> {
  const key = `branding/${tenant.tenant.id}/${target}/${randomUUID()}`;
  await writeMediaFile(key, PNG_BYTES, "image/png");
  writtenKeys.push(key);
  return key;
}

async function objectExists(key: string): Promise<boolean> {
  return (await mediaStorage.readHead(key, PNG_BYTES.length)) !== null;
}

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Section Banner Actions ${suffix}`,
    slug: `section-banner-actions-${suffix}`,
    branchCount: 1,
    userCount: 4,
    cpfSeedOffset: 800,
    includeSampleAnnouncements: false,
  });

  sessionRef.current = {
    tenantId: tenant.tenant.id,
    tenantSlug: tenant.tenant.slug,
    userId: tenant.users[0].id,
    branchId: tenant.users[0].branchId,
    sessionId: randomUUID(),
    role: "admin",
    mustChangePassword: false,
    privacyAccepted: true,
  };
}, 60_000);

afterEach(async () => {
  await Promise.all(writtenKeys.splice(0).map((k) => deleteMediaFile(k).catch(() => {})));
});

afterAll(async () => {
  await cleanupTenant(ownerDb, tenant.tenant.id);
  await ownerDb.$disconnect();
});

describe("confirmBrandingUploadAction — vagas-banner / beneficios-banner (INC-019)", () => {
  it("primeiro confirm grava a key em vagasBannerKey", async () => {
    const key = await writeBrandingObject("vagas-banner");
    const result = await confirmBrandingUploadAction("vagas-banner", key);
    expect(result.ok).toBe(true);
    expect(await findTenantVagasBannerKey(tenant.tenant.id)).toBe(key);
  });

  it("primeiro confirm grava a key em beneficiosBannerKey", async () => {
    const key = await writeBrandingObject("beneficios-banner");
    const result = await confirmBrandingUploadAction("beneficios-banner", key);
    expect(result.ok).toBe(true);
    expect(await findTenantBeneficiosBannerKey(tenant.tenant.id)).toBe(key);
  });

  it("trocar o banner de Vagas apaga SO' o objeto antigo de vagas-banner — os outros 3 targets sobrevivem", async () => {
    // Popula os 4 targets do mesmo tenant antes da troca.
    const homeKey = await writeBrandingObject("banner");
    const logoKey = await writeBrandingObject("logo");
    const oldVagasKey = await writeBrandingObject("vagas-banner");
    const beneficiosKey = await writeBrandingObject("beneficios-banner");
    await confirmBrandingUploadAction("banner", homeKey);
    await confirmBrandingUploadAction("logo", logoKey);
    await confirmBrandingUploadAction("vagas-banner", oldVagasKey);
    await confirmBrandingUploadAction("beneficios-banner", beneficiosKey);

    const newVagasKey = await writeBrandingObject("vagas-banner");
    const result = await confirmBrandingUploadAction("vagas-banner", newVagasKey);
    expect(result.ok).toBe(true);

    // A coluna aponta para a key nova.
    expect(await findTenantVagasBannerKey(tenant.tenant.id)).toBe(newVagasKey);

    // O objeto antigo do PROPRIO target some.
    expect(await objectExists(oldVagasKey)).toBe(false);

    // Os outros 3 targets NAO foram tocados — prova que o mapa
    // PREVIOUS_KEY_BY_TARGET nao cruzou fiacao entre campos.
    expect(await objectExists(homeKey)).toBe(true);
    expect(await objectExists(logoKey)).toBe(true);
    expect(await objectExists(beneficiosKey)).toBe(true);
    expect(await findTenantHomeBannerKey(tenant.tenant.id)).toBe(homeKey);
    expect((await findTenantBranding(tenant.tenant.id)).logoUrl).toBe(logoKey);
    expect(await findTenantBeneficiosBannerKey(tenant.tenant.id)).toBe(beneficiosKey);
  });

  it("trocar o banner de Beneficios apaga SO' o objeto antigo de beneficios-banner — os outros 3 targets sobrevivem", async () => {
    const homeKey = await writeBrandingObject("banner");
    const logoKey = await writeBrandingObject("logo");
    const vagasKey = await writeBrandingObject("vagas-banner");
    const oldBeneficiosKey = await writeBrandingObject("beneficios-banner");
    await confirmBrandingUploadAction("banner", homeKey);
    await confirmBrandingUploadAction("logo", logoKey);
    await confirmBrandingUploadAction("vagas-banner", vagasKey);
    await confirmBrandingUploadAction("beneficios-banner", oldBeneficiosKey);

    const newBeneficiosKey = await writeBrandingObject("beneficios-banner");
    const result = await confirmBrandingUploadAction("beneficios-banner", newBeneficiosKey);
    expect(result.ok).toBe(true);

    expect(await findTenantBeneficiosBannerKey(tenant.tenant.id)).toBe(newBeneficiosKey);
    expect(await objectExists(oldBeneficiosKey)).toBe(false);

    expect(await objectExists(homeKey)).toBe(true);
    expect(await objectExists(logoKey)).toBe(true);
    expect(await objectExists(vagasKey)).toBe(true);
    expect(await findTenantHomeBannerKey(tenant.tenant.id)).toBe(homeKey);
    expect((await findTenantBranding(tenant.tenant.id)).logoUrl).toBe(logoKey);
    expect(await findTenantVagasBannerKey(tenant.tenant.id)).toBe(vagasKey);
  });
});
