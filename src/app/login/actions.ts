"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "../../lib/auth/config";

export async function loginAction(formData: FormData) {
  try {
    await signIn("credentials", {
      tenantSlug: formData.get("tenantSlug"),
      cpf: formData.get("cpf"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?erro=1");
    }
    throw error;
  }
}
