import { getAvatarColors, getInitial } from "../avatar";

/** Equivalente satori de `AvatarFallback` (componente nativo) — implementação
 * própria porque satori só entende estilo inline (nada de classe Tailwind),
 * mas usa as MESMAS funções de `avatar.ts` para que a pessoa caia sempre na
 * mesma inicial/cor nas duas renderizações. `photoUrl`, quando presente,
 * precisa já vir como URL absoluta (satori busca a imagem por fetch). */
export function AvatarNode({
  fullName,
  photoUrl,
  size,
}: {
  fullName: string;
  photoUrl: string | null;
  size: number;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- renderizado por satori (next/og), nao no browser
      <img
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: 9999, objectFit: "cover" }}
      />
    );
  }

  const { bg, fg } = getAvatarColors(fullName);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 9999,
        backgroundColor: bg,
        color: fg,
        fontSize: Math.round(size * 0.4),
        fontWeight: 700,
      }}
    >
      {getInitial(fullName)}
    </div>
  );
}
