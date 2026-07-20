import * as React from "react"

import { cn } from "@/lib/utils"

const selectSizes = {
  default: "h-9 text-sm",
  lg: "h-12 text-base",
} as const

/** Select nativo com o mesmo tratamento do Input elevado (borda 1.5px, foco
 * verde com anel --primary-subtle, nunca laranja). Nativo de propósito:
 * acessível e leve no mobile (design-system §0). */
function Select({
  className,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & { size?: keyof typeof selectSizes }) {
  return (
    <select
      data-slot="select"
      className={cn(
        "w-full min-w-0 rounded-lg border-[1.5px] border-input bg-card px-3 outline-none transition-colors focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-subtle disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        selectSizes[size],
        className
      )}
      {...props}
    />
  )
}

export { Select }
