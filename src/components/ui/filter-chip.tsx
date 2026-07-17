import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/** Chip de filtro em pilula (redesenho 1b, "Busca e filtros"): 40px de
 * altura visual, ativo verde solido, inativo branco com borda. O pseudo
 * `after` invisivel expande a area de toque para >=48px (alvo minimo do
 * design-system §7) sem engordar o visual. Exportado como cva porque os
 * consumidores tipicos sao `<Link>`s de filtro por searchParams. */
const filterChipVariants = cva(
  "relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-[18px] text-[13.5px] whitespace-nowrap transition-colors outline-none select-none after:absolute after:-inset-1 after:content-[''] focus-visible:ring-3 focus-visible:ring-ring/50",
  {
    variants: {
      active: {
        true: "bg-primary font-bold text-primary-foreground",
        false:
          "border-[1.5px] border-border bg-card font-semibold text-foreground-soft hover:bg-muted",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
)

interface FilterChipProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof filterChipVariants> {}

function FilterChip({ className, active, type = "button", ...props }: FilterChipProps) {
  return (
    <button
      data-slot="filter-chip"
      type={type}
      aria-pressed={active === true}
      className={cn(filterChipVariants({ active }), className)}
      {...props}
    />
  )
}

export { FilterChip, filterChipVariants }
