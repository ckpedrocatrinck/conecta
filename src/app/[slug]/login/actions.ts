"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth/config";
import { isRateLimited, recordAttempt, type RateLimitOptions } from "@/lib/security/rate-limit";

// Rate limit por IP no login (INC-013 G5). Limite GENEROSO e contando SO' as
// falhas: um login bem-sucedido nunca consome cota — assim varios colaboradores
// atras do mesmo NAT da loja (mesmo IP publico) nao se bloqueiam. Freia
// brute-force e enumeracao de CPF/tenant (que caem no ramo de falha), sem pegar
// o trafego legitimo. Numero calibravel.
const LOGIN_RATE_LIMIT: RateLimitOptions = { limit: 20, windowMs: 10 * 60 * 1000 };

async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

// Login tenant-scoped (ADR-010 §3 / INC-014 Bloco 2). O `slug` vem da URL,
// fixado por .bind() no servidor (ver page.tsx) — NUNCA de um campo do form.
export async function loginAction(slug: string, formData: FormData) {
  const rateKey = `login:${await getClientIp()}`;

  // Muitas FALHAS recentes deste IP: barra antes de tentar (nao revela nada
  // sobre CPF/empresa). Mensagem generica de "muitas tentativas".
  if (isRateLimited(rateKey, LOGIN_RATE_LIMIT)) {
    redirect(`/${slug}/login?erro=rate`);
  }

  try {
    await signIn("credentials", {
      tenantSlug: slug,
      cpf: formData.get("cpf"),
      password: formData.get("password"),
      // Pos-login: home do tenant (as rotas ja vivem sob /{slug} — Bloco 4).
      redirectTo: `/${slug}`,
    });
  } catch (error) {
    // Erro SEMPRE generico (LGPD): nunca revelar se o CPF ou a empresa existem.
    if (error instanceof AuthError) {
      // So' a FALHA conta para o limite por IP (sucesso nao consome cota).
      recordAttempt(rateKey, LOGIN_RATE_LIMIT);
      redirect(`/${slug}/login?erro=1`);
    }
    throw error;
  }
}
