import { Check } from "lucide-react"

import { getAvatarColors, getInitial } from "@/lib/cards/avatar"
import { cn } from "@/lib/utils"

const avatarSizes = {
  sm: "size-8 text-[11px]",
  md: "size-10 text-[13px]",
  lg: "size-11 text-sm",
  xl: "size-14 text-lg",
} as const

interface AvatarProps extends React.ComponentProps<"div"> {
  name: string
  /** Ja filtrada por consentimento a montante — este componente nunca
   * decide visibilidade de foto, so apresenta o que recebeu. */
  photoUrl?: string | null
  size?: keyof typeof avatarSizes
  /** Selo verde de ciencia confirmada (redesenho 1d). */
  confirmed?: boolean
}

/** Avatar com recorte central obrigatorio (redesenho 1d): foto sempre
 * `cover` + centro, nunca achatada; sem foto, iniciais sobre cor
 * deterministica por hash do nome (mesma paleta do card satori —
 * `src/lib/cards/avatar.ts` e' a fonte unica, por isso o estilo inline). */
function Avatar({
  name,
  photoUrl,
  size = "md",
  confirmed = false,
  className,
  ...props
}: AvatarProps) {
  const colors = getAvatarColors(name)

  return (
    <div
      data-slot="avatar"
      className={cn("relative shrink-0 rounded-full", avatarSizes[size], className)}
      {...props}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada, curta duracao
        <img
          src={photoUrl}
          alt=""
          className="size-full rounded-full object-cover object-center"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-full items-center justify-center rounded-full border-[1.5px] border-primary-deep/15 font-extrabold"
          style={{ backgroundColor: colors.bg, color: colors.fg }}
        >
          {getInitial(name)}
        </span>
      )}
      {confirmed && (
        <span className="absolute -right-0.5 -bottom-0.5 flex size-[18px] items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground">
          <Check className="size-2.5" strokeWidth={3.5} aria-hidden="true" />
          <span className="sr-only">Ciência confirmada</span>
        </span>
      )}
    </div>
  )
}

export { Avatar }
