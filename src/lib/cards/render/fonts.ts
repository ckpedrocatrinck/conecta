import { readFileSync } from "node:fs";
import { join } from "node:path";

// Figtree real no card exportável (INC-013.5): satori (next/og) não lê
// `next/font`; sem registrar a fonte aqui o ImageResponse caía num fallback
// sans-serif genérico. Os arquivos .woff vêm do pacote @fontsource/figtree
// (satori aceita woff; NÃO aceita woff2). Lidos uma vez na carga do módulo —
// a rota roda no runtime Node (sem `export const runtime = "edge"`), então
// `fs` está disponível.
const FONT_DIR = join(process.cwd(), "node_modules", "@fontsource", "figtree", "files");

function loadWeight(weight: number): Buffer {
  return readFileSync(join(FONT_DIR, `figtree-latin-${weight}-normal.woff`));
}

type CardFont = { name: "Figtree"; data: Buffer; weight: 400 | 700 | 800; style: "normal" };

/** Pesos usados pelos templates do card: corpo 400, título 700, display 800. */
export const CARD_FONTS: CardFont[] = [
  { name: "Figtree", data: loadWeight(400), weight: 400, style: "normal" },
  { name: "Figtree", data: loadWeight(700), weight: 700, style: "normal" },
  { name: "Figtree", data: loadWeight(800), weight: 800, style: "normal" },
];
