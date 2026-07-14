import { ImageResponse } from "next/og";
import { renderAppIconNode } from "@/lib/pwa/render-app-icon";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(renderAppIconNode(size.width), { ...size });
}
