import { getAvatarColors, getInitial } from "@/lib/cards/avatar";

/** Avatar do card nativo (feed/preview do admin): foto quando disponível
 * (já filtrada por consentimento antes de chegar aqui — nunca decide
 * consentimento neste componente), senão iniciais + cor derivada
 * (design-system §5). Tamanho em px para caber tanto no card de lista
 * quanto no header maior dos templates. */
export function AvatarFallback({
  fullName,
  photoUrl,
  size = 32,
}: {
  fullName: string;
  photoUrl: string | null;
  size?: number;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL assinada, curta duracao
      <img
        src={photoUrl}
        alt={fullName}
        style={{ width: size, height: size }}
        className="rounded-full object-cover"
      />
    );
  }

  const { bg, fg } = getAvatarColors(fullName);
  return (
    <span
      className="flex items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, backgroundColor: bg, color: fg, fontSize: size * 0.4 }}
    >
      {getInitial(fullName)}
    </span>
  );
}
