import { getTenantBySlug } from "@/lib/tenant/resolve-tenant";
import { BRAND_TOKENS } from "@/lib/cards/brand-tokens";

// Manifest PWA por tenant (INC-014 Bloco 4 / ADR-010 §5). `id`, `start_url` e
// `scope` apontam para /{slug}: cada tenant instala como um app proprio, que
// abre direto na sua home e navega dentro do seu escopo. Ligado ao documento
// via generateMetadata do layout [slug] (rel="manifest" -> /{slug}/manifest).
//
// O service worker (public/sw.js) NAO muda (INC-012): e' network-first de
// navegacao, agnostico de path; ele so' cacheia o /manifest.webmanifest global
// (institucional/fallback), que permanece existindo. O fetch deste manifest por
// tenant nao e' `mode: navigate`, entao o SW nem o intercepta.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  const name = tenant ? `Conecta · ${tenant.name}` : "Conecta";

  const manifest = {
    name,
    short_name: "Conecta",
    description: "Plataforma de comunicação interna",
    id: `/${slug}`,
    start_url: `/${slug}`,
    scope: `/${slug}`,
    display: "standalone",
    background_color: BRAND_TOKENS.background,
    theme_color: BRAND_TOKENS.primary,
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
