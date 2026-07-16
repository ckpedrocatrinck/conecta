"use server";

import { redirect } from "next/navigation";
import { requireOnboardedSession } from "../../../lib/auth/session";
import { performPasswordChange } from "../../../lib/auth/password-change";
import { withTenant } from "../../../lib/db/with-tenant";
import { updateConsentToggles, updatePhotoUrl, findUserById } from "../../../lib/repositories/user.repository";
import { mediaStorage } from "../../../lib/storage/media-storage";

export async function updateConsentAction(formData: FormData) {
  const session = await requireOnboardedSession();

  await withTenant({ tenantId: session.tenantId }, (tx) =>
    updateConsentToggles(tx, session.userId, {
      birthdayVisible: formData.get("birthdayVisible") === "on",
      photoVisible: formData.get("photoVisible") === "on",
    }),
  );

  redirect("/perfil?consentimentos=ok");
}

export async function changePasswordFromProfileAction(formData: FormData) {
  const session = await requireOnboardedSession();

  const outcome = await performPasswordChange(session, {
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (outcome === "no-user") redirect("/login");
  redirect(outcome === "ok" ? "/perfil?senha=ok" : `/perfil?erro=${outcome}`);
}

function avatarKey(tenantId: string, userId: string): string {
  return `avatars/${tenantId}/${userId}`;
}

export async function requestPhotoUploadUrl() {
  const session = await requireOnboardedSession();
  const key = avatarKey(session.tenantId, session.userId);
  const uploadUrl = await mediaStorage.getUploadUrl(key);
  return { uploadUrl, key };
}

export async function confirmPhotoUploadAction(key: string) {
  const session = await requireOnboardedSession();
  const expectedKey = avatarKey(session.tenantId, session.userId);
  if (key !== expectedKey) throw new Error("chave de foto inesperada");

  await withTenant({ tenantId: session.tenantId }, (tx) => updatePhotoUrl(tx, session.userId, key));
}

export async function getOwnProfile() {
  const session = await requireOnboardedSession();
  return withTenant({ tenantId: session.tenantId }, (tx) => findUserById(tx, session.tenantId, session.userId));
}
