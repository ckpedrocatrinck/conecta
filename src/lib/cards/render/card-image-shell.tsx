import type { ReactNode } from "react";
import { CardShapeMotif } from "@/components/cards/card-shape";
import { CARD_KIND_LABEL } from "../card-config";
import { CARD_EXPORT_TOKENS } from "../brand-tokens";
import type { CardData } from "../card-model";
import { KindIconNode } from "./kind-icon-node";

export const CARD_IMAGE_WIDTH = 1200;
export const CARD_IMAGE_HEIGHT = 630;

/** Casca satori do card EXPORTÁVEL (INC-013.5, "campo verde-profundo denso"):
 * fundo verde-profundo, texto claro, tipo em tile translúcido, wordmark
 * "Conecta" e a marca/cor do tenant. Estilo inline porque satori não lê classe
 * Tailwind/CSS var; `logoUrl`, quando presente, precisa já vir absoluta.
 * Fonte "Figtree" é registrada no ImageResponse (rota) — sem fallback. */
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
        backgroundColor: CARD_EXPORT_TOKENS.surface,
        padding: 64,
        fontFamily: "Figtree",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", position: "absolute", top: 0, right: 0 }}>
        <CardShapeMotif color={CARD_EXPORT_TOKENS.motif} opacity={0.07} size={320} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderRadius: 9999,
            backgroundColor: CARD_EXPORT_TOKENS.surfaceRaised,
            padding: "10px 20px 10px 12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 9999,
              backgroundColor: CARD_EXPORT_TOKENS.surfaceRaised,
            }}
          >
            <KindIconNode kind={kind} color={CARD_EXPORT_TOKENS.onSurface} size={22} />
          </div>
          <span style={{ fontSize: 22, fontWeight: 700, color: CARD_EXPORT_TOKENS.onSurface }}>
            {CARD_KIND_LABEL[kind]}
          </span>
        </div>
        {branding.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- renderizado por satori (next/og), nao no browser
          <img src={branding.logoUrl} alt="" width={120} height={40} style={{ objectFit: "contain" }} />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 940 }}>{children}</div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        <span style={{ fontSize: 20, color: CARD_EXPORT_TOKENS.onSurfaceSubtle }}>{meta ?? ""}</span>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", color: CARD_EXPORT_TOKENS.onSurface }}>
          Conecta
        </span>
      </div>
    </div>
  );
}
