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
        "flex flex-col items-center gap-3 rounded-[var(--radius-card)] bg-primary-subtle px-6 py-10 text-center",
        className
      )}
      {...props}
    >
      <Icon className="size-10 text-primary" aria-hidden="true" strokeWidth={1.5} />
      <div className="flex flex-col gap-1">
        <p className="font-bold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export { EmptyState }
