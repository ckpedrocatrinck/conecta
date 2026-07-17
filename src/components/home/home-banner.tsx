import { cn } from "@/lib/utils"

interface HomeBannerProps {
  title: string
  subtitle?: string
  className?: string
}

/**
 * Banner fixo simples da home (INC-013.5, decisão do Pedro): elemento visual
 * leve, NÃO o banner de marketing ocupando a primeira dobra. Banner
 * configurável pelo admin (upload/storage) é Fase 2. Decoração só em tons de
 * verde/neutro — `--action` (laranja) nunca é decoração (design-system §0.1).
 * Compartilhado entre a home do colaborador e o dashboard admin.
 */
export function HomeBanner({ title, subtitle, className }: HomeBannerProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-primary-subtle px-5 py-6 shadow-[var(--shadow-card)]",
        className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 -right-8 size-36 rounded-full bg-primary/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-8 -right-2 size-20 rounded-full bg-primary-deep/10"
      />
      <div className="relative flex flex-col gap-1">
        <p className="text-card-title font-extrabold text-primary-deep">{title}</p>
        {subtitle && <p className="text-meta font-normal text-foreground-soft">{subtitle}</p>}
      </div>
    </div>
  )
}
