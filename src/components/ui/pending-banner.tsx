import { AlertTriangle } from "lucide-react"

import { cn } from "@/lib/utils"

interface PendingBannerProps extends React.ComponentProps<"div"> {
  message: string
  action?: React.ReactNode
}

/** Banner de pendencia (redesenho 1c/1g): card branco com borda
 * --action-border, icone em tile laranja-claro e CTA em largura total.
 * Sem prop de fechar — persiste enquanto houver pendencia (design-system
 * §4, estruturalmente impossivel fechar sem editar o componente). */
function PendingBanner({ message, action, className, ...props }: PendingBannerProps) {
  return (
    <div
      data-slot="pending-banner"
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius-card)] border-[1.5px] border-action-border bg-card p-4 shadow-[var(--shadow-card)]",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-action-subtle text-action">
          <AlertTriangle className="size-3.5" aria-hidden="true" strokeWidth={2.4} />
        </span>
        <p className="text-meta font-bold text-action-deep">{message}</p>
      </div>
      {action && <div className="flex flex-col [&>*]:w-full">{action}</div>}
    </div>
  )
}

export { PendingBanner }
