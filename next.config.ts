import type { NextConfig } from "next";

// Headers de seguranca (INC-013 Bloco B / G4 da auditoria de conformidade).
// Aplicados a todas as rotas via headers(). Ver docs/00-Processo/
// auditoria-conformidade-lgpd-2026-07.md (G4).

const isDev = process.env.NODE_ENV === "development";

// CSP baseline CONSERVADORA (nao quebra por construcao): 'unsafe-inline' PERMITE
// os scripts/estilos inline que o Next injeta, entao nenhum bloqueio de inline
// derruba o app. Fontes (Figtree via next/font + @fontsource) e midia
// (/api/media) sao same-origin -> 'self'. Icones/preview usam data:/blob:. Nao
// ha' CDN/analytics/origem externa hoje. CSP estrita com nonce fica como
// hardening futuro (exige middleware + trial em Report-Only). Quando o R2 de
// midia entrar, somar seu host a img-src/connect-src.
// 'unsafe-eval' so' em desenvolvimento (HMR/Fast Refresh do Turbopack precisa);
// producao nao leva eval.
const scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  // HSTS: forca HTTPS por 2 anos, incluindo subdominios. SEM `preload` por ora
  // (INC-013): entrar na preload list e' quase-irreversivel (sair leva meses) e
  // prenderia dominio + subdominios a HTTPS obrigatorio — arriscado enquanto a
  // arquitetura de dominio/subdominio e o nome ("Conecta"/DP-02) ainda evoluem.
  // TODO(pos-estabilizacao do dominio de producao): adicionar `; preload` e
  // submeter em hstspreload.org.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
