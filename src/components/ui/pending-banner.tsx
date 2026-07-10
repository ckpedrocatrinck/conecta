import { AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"

interface PendingBannerProps extends React.ComponentProps<"div"> {
  message: string
  action?: React.ReactNode
}

function PendingBanner({ message, action, className, ...props }: PendingBannerProps) {
  return (
    <div
      data-slot="pending-banner"
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-lg bg-action-subtle px-4 py-3 text-foreground",
        className
      )}
      {...props}
    >
      <AlertCircle className="size-5 shrink-0 text-action" aria-hidden="true" />
      <p className="flex-1 text-sm font-medium">{message}</p>
      {action}
    </div>
  )
}

export { PendingBanner }
