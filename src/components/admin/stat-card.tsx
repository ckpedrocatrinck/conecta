import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: number | string
  hint?: string
  /** Número em laranja — SÓ para pendência/urgência que exige o usuário
   * (ex. ciências pendentes). Número que é só dado fica em tinta. O valor é
   * grande (≥24px bold) → laranja passa AA como texto grande. */
  accent?: boolean
}

/** Card de resumo do dashboard admin (INC-013.5). Contagens read-only. */
export function StatCard({ label, value, hint, accent = false }: StatCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <span className="text-meta text-muted-foreground">{label}</span>
      <span className={cn("text-3xl leading-none font-extrabold", accent ? "text-action" : "text-foreground")}>
        {value}
      </span>
      {hint && <span className="text-meta text-subtle-foreground">{hint}</span>}
    </div>
  )
}
