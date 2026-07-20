"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { performPasswordChange } from "@/lib/auth/password-change";

export async function changePasswordAction(formData: FormData) {
  const session = await requireSession();

  const outcome = await performPasswordChange(session, {
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (outcome === "no-user") redirect(`/${session.tenantSlug}/login`);
  if (outcome !== "ok") redirect(`/${session.tenantSlug}/trocar-senha?erro=${outcome}`);

  redirect(`/${session.tenantSlug}/aviso-privacidade`);
}
