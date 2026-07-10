import { NextResponse } from "next/server";
import { auth } from "./src/lib/auth/config";

// Guard rapido, edge-safe (so' decodifica o JWT do cookie, sem tocar banco):
// exige sessao para qualquer rota fora da lista publica, e um papel admin
// para /admin/**. A checagem de verdade (sessao revogada? usuario ainda
// ativo? senha ja trocada? aviso ja aceito?) mora em src/lib/auth/session.ts
// (requireSession/requireOnboardedSession/requireAdmin), chamada em cada
// Server Component/Server Action — este middleware e' so' a primeira
// camada, mais rapida, nao a fonte de verdade (ADR-007).

const PUBLIC_PATHS = ["/login", "/403", "/api/health"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (isPublic) return NextResponse.next();

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
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
