import type { CardData } from "../card-model";

// Ícones do satori (imagem exportável) NÃO podem usar os componentes do
// lucide-react diretamente: `Icon` (lucide) lê de um React Context interno
// (useLucideContext), e o motor de satori embutido no next/og resolve a
// árvore de elementos com seu próprio reconciliador — sem Provider real, o
// hook quebra ("Cannot read properties of null (reading 'useContext')"),
// confirmado rodando a geração de imagem de verdade. A versão nativa (feed/
// preview do admin, card-config.ts) roda em React DOM de verdade e não tem
// esse problema — só o satori precisa desse contorno.
//
// Em vez de reimportar caminhos internos do pacote lucide-react (frágil,
// não é API pública), copiamos aqui a geometria (`d`/atributos) dos mesmos
// 5 ícones usados na versão nativa — mesmo desenho, sem depender do
// componente com contexto.
type IconNode = [string, Record<string, string | number>][];

const AWARD: IconNode = [
  [
    "path",
    {
      d: "m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526",
    },
  ],
  ["circle", { cx: "12", cy: "8", r: "6" }],
];

const CALENDAR_CLOCK: IconNode = [
  ["path", { d: "M16 14v2.2l1.6 1" }],
  ["path", { d: "M16 2v4" }],
  ["path", { d: "M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" }],
  ["path", { d: "M3 10h5" }],
  ["path", { d: "M8 2v4" }],
  ["circle", { cx: "16", cy: "16", r: "6" }],
];

const TRENDING_UP: IconNode = [
  ["path", { d: "M16 7h6v6" }],
  ["path", { d: "m22 7-8.5 8.5-5-5L2 17" }],
];

const CAKE: IconNode = [
  ["path", { d: "M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" }],
  ["path", { d: "M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" }],
  ["path", { d: "M2 21h20" }],
  ["path", { d: "M7 8v3" }],
  ["path", { d: "M12 8v3" }],
  ["path", { d: "M17 8v3" }],
  ["path", { d: "M7 4h.01" }],
  ["path", { d: "M12 4h.01" }],
  ["path", { d: "M17 4h.01" }],
];

const BRIEFCASE: IconNode = [
  ["path", { d: "M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" }],
  ["rect", { width: "20", height: "14", x: "2", y: "6", rx: "2" }],
];

export const CARD_KIND_ICON_NODE: Record<CardData["kind"], IconNode> = {
  recognition: AWARD,
  tenure: CALENDAR_CLOCK,
  promotion: TRENDING_UP,
  birthday: CAKE,
  job_opening: BRIEFCASE,
};

export function KindIconNode({ kind, color, size }: { kind: CardData["kind"]; color: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {CARD_KIND_ICON_NODE[kind].map(([tag, attrs], index) => {
        const Tag = tag;
        return <Tag key={index} {...attrs} />;
      })}
    </svg>
  );
}
