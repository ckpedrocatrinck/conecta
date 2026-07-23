"use server";

import { redirect } from "next/navigation";
import type { BenefitCategory } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { deleteBenefit, setBenefitActive, updateBenefitFields } from "@/lib/repositories/benefit.repository";
import { recordAuditLog } from "@/lib/repositories/audit-log.repository";
import { BENEFIT_CATEGORY_ORDER } from "@/lib/benefits/category-labels";

function parseSortOrder(raw: string): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

export async function updateBenefitAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const category = String(formData.get("category") ?? "").trim();
  const partnerName = String(formData.get("partnerName") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const sortOrder = parseSortOrder(String(formData.get("sortOrder") ?? ""));

  const validCategory = BENEFIT_CATEGORY_ORDER.includes(category as BenefitCategory);
  if (!id || !validCategory || !partnerName || !title || !description) {
    redirect(`/${session.tenantSlug}/admin/beneficios/${id}?erro=obrigatorio`);
  }

  await withTenant({ tenantId: session.tenantId }, async (tx) => {
    await updateBenefitFields(tx, session.tenantId, id, {
      category: category as BenefitCategory,
      partnerName,
      title,
      description,
      location: location || null,
      contact: contact || null,
      sortOrder,
    });

    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "benefit.update",
      entity: "Benefit",
      entityId: id,
    });
  });

  redirect(`/${session.tenantSlug}/admin/beneficios/${id}?salvo=ok`);
}

/** Ativar/desativar (reversivel, sem confirmacao). O novo estado vem do form
 * como string "true"/"false" para nao depender de checkbox. */
export async function toggleBenefitActiveAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) redirect(`/${session.tenantSlug}/admin/beneficios`);

  await withTenant({ tenantId: session.tenantId }, async (tx) => {
    await setBenefitActive(tx, session.tenantId, id, active);
    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: active ? "benefit.activate" : "benefit.deactivate",
      entity: "Benefit",
      entityId: id,
    });
  });

  redirect(`/${session.tenantSlug}/admin/beneficios/${id}?ok=${active ? "ativado" : "desativado"}`);
}

/** Remocao definitiva — chamada pelo ConfirmDialog destrutivo (padrao INC-012.5). */
export async function deleteBenefitAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`/${session.tenantSlug}/admin/beneficios`);

  await withTenant({ tenantId: session.tenantId }, async (tx) => {
    await deleteBenefit(tx, session.tenantId, id);
    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "benefit.delete",
      entity: "Benefit",
      entityId: id,
    });
  });

  redirect(`/${session.tenantSlug}/admin/beneficios?ok=removido`);
}
