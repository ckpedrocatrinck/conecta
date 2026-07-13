import type { ReactNode } from "react";
import { CardShapeMotif } from "@/components/cards/card-shape";
import { CARD_KIND_LABEL } from "../card-config";
import { BRAND_TOKENS } from "../brand-tokens";
import type { CardData } from "../card-model";
import { KindIconNode } from "./kind-icon-node";

export const CARD_IMAGE_WIDTH = 1200;
export const CARD_IMAGE_HEIGHT = 630;

/** Casca satori equivalente ao `CardShell` nativo — mesma composição
 * (ícone/rótulo do tipo, logo do tenant, forma geométrica, acento de cor),
 * reimplementada com estilo inline porque satori não lê classe
 * Tailwind/CSS var. `logoUrl`, quando presente, precisa já vir absoluta. */
export function CardImageShell({
  kind,
  branding,
  meta,
  children,
}: {
  kind: CardData["kind"];
  branding: CardData["branding"];
  meta?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        backgroundColor: BRAND_TOKENS.card,
        padding: 56,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", position: "absolute", top: 0, right: 0 }}>
        <CardShapeMotif color={branding.accentColor} size={260} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 9999,
              backgroundColor: `${branding.accentColor}1F`,
            }}
          >
            <KindIconNode kind={kind} color={branding.accentColor} size={28} />
          </div>
          <span style={{ fontSize: 26, fontWeight: 700, color: branding.accentColor }}>
            {CARD_KIND_LABEL[kind]}
          </span>
        </div>
        {branding.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- renderizado por satori (next/og), nao no browser
          <img src={branding.logoUrl} alt="" width={120} height={40} style={{ objectFit: "contain" }} />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900 }}>{children}</div>

      <span style={{ fontSize: 20, color: BRAND_TOKENS.subtleForeground }}>{meta ?? ""}</span>
    </div>
  );
}
