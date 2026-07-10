import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

interface LoadingProps extends React.ComponentProps<"div"> {
  message?: string
}

function Loading({ message = "Carregando…", className, ...props }: LoadingProps) {
  return (
    <div
      data-slot="loading"
      role="status"
      className={cn("flex flex-col items-center gap-2 py-10 text-muted-foreground", className)}
      {...props}
    >
      <Loader2 className="size-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

export { Loading }
