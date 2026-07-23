"use server";

import { redirect } from "next/navigation";
import type { BenefitCategory } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { createBenefit } from "@/lib/repositories/benefit.repository";
import { recordAuditLog } from "@/lib/repositories/audit-log.repository";
import { BENEFIT_CATEGORY_ORDER } from "@/lib/benefits/category-labels";

function parseSortOrder(raw: string): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

export async function createBenefitAction(formData: FormData) {
  const session = await requireAdmin();

  const category = String(formData.get("category") ?? "").trim();
  const partnerName = String(formData.get("partnerName") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const sortOrder = parseSortOrder(String(formData.get("sortOrder") ?? ""));

  const validCategory = BENEFIT_CATEGORY_ORDER.includes(category as BenefitCategory);
  if (!validCategory || !partnerName || !title || !description) {
    redirect(`/${session.tenantSlug}/admin/beneficios/novo?erro=obrigatorio`);
  }

  const benefitId = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const benefit = await createBenefit(tx, {
      tenantId: session.tenantId,
      category: category as BenefitCategory,
      partnerName,
      title,
      description,
      location: location || null,
      contact: contact || null,
      sortOrder,
      createdBy: session.userId,
    });

    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "benefit.create",
      entity: "Benefit",
      entityId: benefit.id,
    });

    return benefit.id;
  });

  redirect(`/${session.tenantSlug}/admin/beneficios/${benefitId}?salvo=ok`);
}
