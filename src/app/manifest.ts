import type { MetadataRoute } from "next";
import { BRAND_TOKENS } from "@/lib/cards/brand-tokens";

// PWA instalavel (INC-012 / ADR-002). "Conecta" e' nome placeholder (DP-02);
// icones sao placeholder visual ate' o redesenho do DP-14.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Conecta",
    short_name: "Conecta",
    description: "Plataforma de comunicação interna",
    start_url: "/",
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
}
