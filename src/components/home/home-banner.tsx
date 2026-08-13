import { cn } from "@/lib/utils"

// `aspect-video` (16:9) casa o CONTAINER com o "Tamanho recomendado:
// 1920x1080px (16:9)" da tela de Aparência — antes a altura fixa (max-h-52)
// com w-full deixava o container muito mais largo que 16:9 em qualquer tela
// >~370px, e o object-cover cortava topo/base de uma arte corretamente 16:9
// (achado INC-027 Bloco 3.6). `max-w-2xl` (mesmo teto usado nas telas que
// hospedam este banner) evita que o container vire gigante em telas admin
// sem largura maxima propria. `mx-auto` centraliza quando o pai e' mais
// largo que o teto. Exportada (não só usada inline) para o teste unitário
// travar a proporção — não há infra de render de componente neste projeto
// (vitest roda em `environment: "node"`, sem jsdom/testing-library), então
// o teste verifica a string de classes em vez do DOM renderizado.
export const HOME_BANNER_IMAGE_CLASSNAME =
  "mx-auto aspect-video h-auto w-full max-w-2xl rounded-[var(--radius-card)] border border-border object-cover";

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
        className={cn(HOME_BANNER_IMAGE_CLASSNAME, className)}
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
