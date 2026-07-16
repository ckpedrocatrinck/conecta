import { ImageResponse } from "next/og";
import { renderAppIconNode } from "@/lib/pwa/render-app-icon";

const SIZE = 512;

// "purpose: maskable" no manifest: o SO pode recortar o icone em qualquer
// forma, entao o glifo fica menor/centrado (safe zone), ver renderAppIconNode.
export function GET() {
  return new ImageResponse(renderAppIconNode(SIZE, true), {
    width: SIZE,
    height: SIZE,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
