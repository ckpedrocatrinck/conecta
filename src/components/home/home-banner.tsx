import { cn } from "@/lib/utils"

interface HomeBannerProps {
  title: string
  subtitle?: string
  className?: string
  /** Arte de banner pronta (INC-013.5): quando presente, o banner vira só a
   * imagem — usada na home (arte com o texto já embutido) e em Vagas (arte sem
   * texto). O cantos arredondados/fundo já vêm embutidos no asset; o container
   * só recorta no raio do card. Sem `imageSrc`, cai no bloco de texto leve
   * (usado no dashboard admin). */
  imageSrc?: string
  imageAlt?: string
}

/**
 * Banner da home (INC-013.5). Dois modos:
 * - `imageSrc`: renderiza a arte fornecida pelo tenant (asset em /public).
 * - só texto: bloco leve verde-claro (decoração só em verde/neutro — `--action`
 *   nunca é decoração, design-system §0.1). Compartilhado entre a home do
 *   colaborador, o dashboard admin e a lista de vagas.
 */
export function HomeBanner({ title, subtitle, className, imageSrc, imageAlt }: HomeBannerProps) {
  if (imageSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- banner estático em /public; <img> evita declarar dimensões fixas e distorcer a arte
      <img
        src={imageSrc}
        alt={imageAlt ?? title}
        // Faixa larga e mais baixa (decisão do Pedro): ocupa toda a largura, com
        // altura limitada — no desktop `object-cover` apara a margem (quase vazia)
        // de cima/baixo da arte, virando uma faixa horizontal. No mobile (altura
        // natural < max-h) mostra a arte inteira, sem recorte.
        className={cn(
          "h-auto max-h-52 w-full rounded-[var(--radius-card)] border border-border object-cover",
          className,
        )}
      />
    )
  }

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
