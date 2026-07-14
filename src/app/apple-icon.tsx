import { ImageResponse } from "next/og";
import { renderAppIconNode } from "@/lib/pwa/render-app-icon";

// 180x180 e' o tamanho recomendado pela Apple para o icone de tela inicial
// (ADR-002: instalacao no iOS depende desse icone existir).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(renderAppIconNode(size.width), { ...size });
}
