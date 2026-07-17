import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1.5 rounded-full text-label whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      // Estados de comunicado do redesenho 1c — sempre cor + rotulo,
      // nunca so cor (design-system §7).
      variant: {
        // "Novo (nao lido)" — tint verde; usar com `dot`
        new: "bg-primary-subtle px-3 py-1 text-primary-deep",
        // Pendencia acionavel ("Confirmar leitura") — unico badge solido.
        // Fundo --action-deep (nao --action): e' o laranja do redesenho que
        // passa AA com texto branco pequeno (ver comentario no globals.css).
        pending: "bg-action-deep px-3.5 py-1.5 text-action-foreground",
        // Estado recuado ("Lido"/"Confirmado") — outline neutro + check
        quiet: "border border-border-strong px-3 py-1 font-semibold text-subtle-foreground",
        // Rotulo de secao/tipo (ex. RECONHECIMENTO) — marca, nao acao
        label: "bg-primary-subtle px-3 py-1 uppercase text-primary-deep",
        // Contador de pendencia (nav, trilho admin) — bolinha laranja
        count:
          "min-w-[19px] justify-center bg-action-deep px-1.5 py-px text-[11px] font-extrabold text-action-foreground",
      },
    },
    defaultVariants: {
      variant: "new",
    },
  }
)

interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {
  /** Ponto de 7px antes do texto (padrao do estado "Novo", redesenho 1c). */
  dot?: boolean
}

function Badge({ className, variant, dot = false, children, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span aria-hidden="true" className="size-[7px] shrink-0 rounded-full bg-primary" />
      )}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
