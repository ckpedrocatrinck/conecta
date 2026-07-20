"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth/config";

// Login tenant-scoped (ADR-010 §3 / INC-014 Bloco 2). O `slug` vem da URL,
// fixado por .bind() no servidor (ver page.tsx) — NUNCA de um campo do form,
// que o cliente poderia adulterar. O authorize resolve esse slug -> tenant e
// busca o usuario por cpf_hash escopado a esse tenant; CPF+senha inalterados.
export async function loginAction(slug: string, formData: FormData) {
  try {
    await signIn("credentials", {
      tenantSlug: slug,
      cpf: formData.get("cpf"),
      password: formData.get("password"),
      // Bloco 2: a aplicacao ainda vive nas rotas planas (a migracao para
      // /{slug}/** e' o Bloco 4), entao o pos-login cai na home atual "/". No
      // Bloco 4 este destino passa a ser `/${slug}`.
      redirectTo: "/",
    });
  } catch (error) {
    // Erro SEMPRE generico (LGPD): nunca revelar se o CPF ou a empresa existem.
    if (error instanceof AuthError) {
      redirect(`/${slug}/login?erro=1`);
    }
    throw error;
  }
}
