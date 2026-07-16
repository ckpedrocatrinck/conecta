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

export const MIDDLEWARE_MATCHER = "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico).*)";

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
