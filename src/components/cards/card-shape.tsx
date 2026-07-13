// Textura de forma geometrica da marca (design-system.md §5) para os cards
// gerados. Nao existe um asset definido no design-system alem do conceito
// ("leve e escalavel") — motivo abstrato provisorio (arco), a substituir se
// o redesenho com Claude Design (DP-14) especificar outra forma.
//
// So' usa atributos SVG puros (sem classe Tailwind/CSS var) de proposito:
// isso deixa o MESMO componente utilizavel tanto no template nativo (feed)
// quanto no template satori (imagem exportavel, que so' entende um
// subconjunto de CSS) — uma unica fonte de verdade para a forma.
export function CardShapeMotif({
  color,
  opacity = 0.12,
  size = 160,
}: {
  color: string;
  opacity?: number;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" fill="none">
      <circle cx="160" cy="0" r="150" fill={color} opacity={opacity} />
      <circle cx="160" cy="0" r="90" fill={color} opacity={opacity} />
    </svg>
  );
}
