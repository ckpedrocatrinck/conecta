import { ImageResponse } from "next/og";
import { renderAppIconNode } from "@/lib/pwa/render-app-icon";

const SIZE = 192;

// URL fixa (/icon-192.png) referenciada por src/app/manifest.ts — nao
// depende do path auto-gerado do Next para icon.tsx, que so' produz 1
// tamanho por arquivo.
export function GET() {
  return new ImageResponse(renderAppIconNode(SIZE), {
    width: SIZE,
    height: SIZE,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
