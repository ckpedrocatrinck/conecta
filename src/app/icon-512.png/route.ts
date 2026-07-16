import { ImageResponse } from "next/og";
import { renderAppIconNode } from "@/lib/pwa/render-app-icon";

const SIZE = 512;

export function GET() {
  return new ImageResponse(renderAppIconNode(SIZE), {
    width: SIZE,
    height: SIZE,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
