// Config pura (sem next-auth) usada pelo middleware.ts e testavel direto —
// importar middleware.ts em teste arrasta NextAuth() e quebra em ambiente
// node do vitest ("Cannot find module 'next/server'" via next-auth/lib/env.js,
// que espera Edge/Next runtime). Mantendo isso aqui, o teste do matcher/
// PUBLIC_PATHS (A2-1/A2-3) fica isolado dessa dependencia.

export const PUBLIC_PATHS = [
  "/login",
  "/403",
  "/api/health",
  "/manifest.webmanifest",
  "/offline",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
];

// Precisa ser IDENTICO ao literal em `config.matcher` de middleware.ts — o
// Next exige que aquele export seja uma string literal estatica (nao aceita
// importar esta constante ali), entao o padrao fica duplicado nos dois
// lugares de proposito. Mudou um, muda o outro.
export const MIDDLEWARE_MATCHER = "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico).*)";

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
