"use server";

import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import {
  findTenantBranding,
  findTenantHomeBannerKey,
  updateTenantAppearance,
} from "@/lib/repositories/tenant.repository";
import { recordAuditLog } from "@/lib/repositories/audit-log.repository";
import { mediaStorage } from "@/lib/storage/media-storage";
import { uploadRejectMessage, validateUploadedObject } from "@/lib/storage/validate-upload";

// Aparencia da empresa (INC-017): banner da home + logo (imagens no storage,
// mesmo fluxo do INC-016: presigned + magic number no confirm) + cor de
// destaque (texto, sem R2). Admin-only.

export type BrandingTarget = "banner" | "logo";

function brandingKey(tenantId: string, target: BrandingTarget): string {
  // uuid por upload: cada troca e' um objeto NOVO — o banner/logo atual nunca e'
  // sobrescrito antes da validacao; a troca de key + remocao do antigo so'
  // acontece no confirm aprovado (ver confirmBrandingUploadAction).
  return `branding/${tenantId}/${target}/${randomUUID()}`;
}

/** Chamada direta pelo componente client (nao via <form>): gera a URL assinada
 * de envio do banner ou logo. Admin-only. O upload vai DIRETO ao storage; o
 * tipo real e' reconferido no confirm (validateUploadedObject). */
export async function requestBrandingUploadUrl(target: BrandingTarget) {
  const session = await requireAdmin();
  const key = brandingKey(session.tenantId, target);
  const uploadUrl = await mediaStorage.getUploadUrl(key);
  return { uploadUrl, key };
}

export type ConfirmBrandingResult = { ok: true } | { ok: false; error: string };

/** Pos-upload: le o cabecalho do objeto, valida tipo REAL (magic number) e
 * tamanho de imagem, e so' entao grava a key nova no tenant. Objeto reprovado
 * (ou nao-imagem) e' apagado; o banner/logo ANTERIOR permanece intacto porque a
 * key nova e' um objeto separado. No sucesso, remove o objeto antigo. */
export async function confirmBrandingUploadAction(
  target: BrandingTarget,
  key: string,
): Promise<ConfirmBrandingResult> {
  const session = await requireAdmin();

  const expectedPrefix = `branding/${session.tenantId}/${target}/`;
  if (!key.startsWith(expectedPrefix)) {
    await mediaStorage.delete(key).catch(() => {});
    return { ok: false, error: "Chave de mídia inesperada." };
  }

  const validation = await validateUploadedObject(mediaStorage, key);
  if (!validation.ok) {
    return { ok: false, error: uploadRejectMessage(validation.reason) };
  }
  // Branding e' so' imagem: um PDF (tipo real valido no fluxo de anexos) nao
  // serve como banner/logo. validateUploadedObject nao apaga tipos aceitos —
  // apagamos aqui.
  if (validation.kind !== "image") {
    await mediaStorage.delete(key).catch(() => {});
    return { ok: false, error: "Envie uma imagem (JPG, PNG ou WEBP)." };
  }

  const field = target === "banner" ? "homeBannerKey" : "logoUrl";
  const previousKey = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const previous =
      target === "banner"
        ? await findTenantHomeBannerKey(session.tenantId)
        : (await findTenantBranding(session.tenantId)).logoUrl;

    await updateTenantAppearance(tx, session.tenantId, { [field]: key });
    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "tenant.appearance.update",
      entity: "Tenant",
      entityId: session.tenantId,
      metadata: { field: target, mime: validation.contentType, sizeBytes: validation.sizeBytes },
    });
    return previous;
  });

  // Remove o objeto antigo (se havia um e nao e' a mesma key). Idempotente.
  if (previousKey && previousKey !== key) {
    await mediaStorage.delete(previousKey).catch(() => {});
  }

  return { ok: true };
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export type UpdateAccentColorResult = { ok: true } | { ok: false; error: string };

/** Cor de destaque do tenant (`accentColor`). Salva NO ATO (chamada direta pelo
 * componente client ao mudar a cor, sem botao — mesmo padrao "muda => salva =>
 * confirma" do banner/logo). Texto no banco: NAO depende de R2, funciona no
 * piloto independente do storage. Retorna resultado para o feedback inline. */
export async function updateAccentColorAction(accentColor: string): Promise<UpdateAccentColorResult> {
  const session = await requireAdmin();
  const value = accentColor.trim().toLowerCase();

  if (!HEX_COLOR.test(value)) {
    return { ok: false, error: "Cor inválida (use o seletor)." };
  }

  await withTenant({ tenantId: session.tenantId }, async (tx) => {
    await updateTenantAppearance(tx, session.tenantId, { accentColor: value });
    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "tenant.appearance.update",
      entity: "Tenant",
      entityId: session.tenantId,
      metadata: { field: "accentColor", value },
    });
  });

  return { ok: true };
}
