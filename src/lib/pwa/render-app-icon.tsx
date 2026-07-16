import { BRAND_TOKENS } from "../cards/brand-tokens";

/**
 * Icone placeholder do PWA (INC-012) — "Conecta" ainda e' nome provisorio
 * (DP-02) e nao ha' marca final (DP-14 reformula o visual depois). Reusa o
 * mesmo motor satori (next/og) do card de post (INC-009), so' com um "C"
 * sobre o verde de marca — nunca o laranja de acao (design-system.md §0.1).
 *
 * `maskable` desenha o glifo dentro da safe zone (~80% do canvas): o SO
 * pode recortar o icone em qualquer forma (circulo, squircle) e o conteudo
 * fora dessa zona pode ser cortado.
 */
export function renderAppIconNode(size: number, maskable = false) {
  const glyphSize = maskable ? size * 0.5 : size * 0.62;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        backgroundColor: BRAND_TOKENS.primary,
      }}
    >
      <span
        style={{
          fontFamily: "sans-serif",
          fontWeight: 700,
          fontSize: glyphSize,
          color: "#ffffff",
        }}
      >
        C
      </span>
    </div>
  );
}
