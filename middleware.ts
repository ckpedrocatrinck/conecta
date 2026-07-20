import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./src/lib/auth/edge-config";
import { isPublicPath } from "./src/lib/auth/middleware-paths";
import { extractTenantSlug } from "./src/lib/tenant/slug-path";

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

  // INC-014 Bloco 1: extrai o slug candidato do path (string, edge-safe) e o
  // propaga via header interno `x-tenant-slug` para a camada Node consumir na
  // resolucao AUTORITATIVA (resolve-tenant.ts + boundary [slug]). Aqui e' so'
  // transporte — o 404 e a validacao de vinculo sessao<->tenant vivem no Node
  // (ADR-010 §2 corrigido). A checagem leve (slug da URL x tenantSlug do JWT) e
  // o redirect por-tenant chegam no Bloco 3; ate' la' a auth abaixo e' a mesma.
  //
  // SEGURANCA: o header e' SEMPRE reescrito a partir do valor derivado no
  // servidor (ou removido) — assim um `x-tenant-slug` que o cliente tente
  // injetar na request nunca sobrevive ate' a camada Node.
  const tenantSlug = extractTenantSlug(pathname);
  const forward = () => {
    const headers = new Headers(req.headers);
    if (tenantSlug) headers.set("x-tenant-slug", tenantSlug);
    else headers.delete("x-tenant-slug");
    return NextResponse.next({ request: { headers } });
  };

  // Login tenant-scoped e assets publicos: passam sem sessao.
  if (isPublicPath(pathname)) return forward();

  // Rotas sem tenant no path (ex.: "/" institucional — fora de escopo; /api/*
  // que se auto-protegem com 401): deixa o Next resolver. Nao forca login: nao
  // ha' tenant destino, e os /api/* respondem 401 sozinhos.
  if (!tenantSlug) return forward();

  const user = req.auth?.user;

  // Nao autenticado numa rota de tenant -> login DESSE tenant.
  if (!user) {
    return NextResponse.redirect(new URL(`/${tenantSlug}/login`, req.nextUrl));
  }

  // Compare LEVE de vinculo sessao<->tenant (INC-014 Bloco 4). Fast-fail de UX,
  // NAO a barreira: a barreira e' o guard Node (requireSession) + RLS. Sessao de
  // outro tenant nesta URL, ou JWT antigo sem tenantSlug -> login do tenant da
  // URL, sem tocar dados. O tenantSlug do JWT e' assinado (cliente nao forja).
  if (user.tenantSlug !== tenantSlug) {
    return NextResponse.redirect(new URL(`/${tenantSlug}/login`, req.nextUrl));
  }

  // /{slug}/admin/** exige papel admin (checagem rapida; o Node reconfirma em
  // requireAdmin). /{slug}/pendencias aceita manager -> fica para o guard Node.
  const segments = pathname.split("/").filter(Boolean); // [slug, secao, ...]
  if (segments[1] === "admin" && user.role !== "admin") {
    return NextResponse.redirect(new URL("/403", req.nextUrl));
  }

  return forward();
});

// O Next analisa este export de forma estatica em build-time (Turbopack) —
// nao aceita referencia a uma constante importada, so' string literal. Por
// isso o padrao fica duplicado aqui e em MIDDLEWARE_MATCHER
// (src/lib/auth/middleware-paths.ts, usado pelo teste em middleware.test.ts)
// — manter os dois em sincronia se este padrao mudar.
export const config = {
  matcher: ["/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico).*)"],
};
