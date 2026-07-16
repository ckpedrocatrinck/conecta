import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./src/lib/auth/edge-config";
import { isPublicPath, MIDDLEWARE_MATCHER } from "./src/lib/auth/middleware-paths";

// Usa SO' a config edge-safe (sem providers) — importar ./src/lib/auth/config
// aqui puxaria o Credentials provider (hashCpf/withTenant), que dependem de
// node:crypto e conexao Postgres direta, nenhum edge-compativel. Ver
// edge-config.ts.
const { auth } = NextAuth(authConfig);

// Guard rapido, edge-safe (so' decodifica o JWT do cookie, sem tocar banco):
// exige sessao para qualquer rota fora da lista publica, e um papel admin
// para /admin/**. A checagem de verdade (sessao revogada? usuario ainda
// ativo? senha ja trocada? aviso ja aceito?) mora em src/lib/auth/session.ts
// (requireSession/requireOnboardedSession/requireAdmin), chamada em cada
// Server Component/Server Action — este middleware e' so' a primeira
// camada, mais rapida, nao a fonte de verdade (ADR-007).

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  if (!req.auth?.user) {
    const loginUrl = new URL("/login", req.nextUrl);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && req.auth.user.role !== "admin") {
    return NextResponse.redirect(new URL("/403", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [MIDDLEWARE_MATCHER],
};
