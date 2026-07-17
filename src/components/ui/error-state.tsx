import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ErrorStateProps extends React.ComponentProps<"div"> {
  message?: string
  onRetry?: () => void
  retryLabel?: string
}

function ErrorState({
  message = "Não foi possível carregar. Tente novamente.",
  onRetry,
  retryLabel = "Tentar novamente",
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      data-slot="error-state"
      role="alert"
      className={cn("flex flex-col items-center gap-3 py-10 text-center", className)}
      {...props}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" aria-hidden="true" strokeWidth={1.8} />
      </div>
      <p className="text-meta font-normal text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="default" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  )
}

export { ErrorState }
