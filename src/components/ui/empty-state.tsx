import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface EmptyStateProps extends React.ComponentProps<"div"> {
  icon: LucideIcon
  title: string
  description: string
}

function EmptyState({ icon: Icon, title, description, className, ...props }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        // Vazio do redesenho 1c: card branco tracejado, icone em circulo
        // verde-claro — nunca tela branca muda
        "flex flex-col items-center gap-2.5 rounded-[var(--radius-card)] border border-dashed border-border-strong bg-card px-5 py-7 text-center",
        className
      )}
      {...props}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-primary-subtle text-primary">
        <Icon className="size-6" aria-hidden="true" strokeWidth={1.8} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-body font-bold text-foreground">{title}</p>
        <p className="mx-auto max-w-60 text-meta font-normal text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export { EmptyState }
