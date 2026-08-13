import { cn } from "@/lib/utils"

// INC-027 Bloco 3.8 (padrão definido pelo Pedro): 1920×650px (≈2,954:1) é a
// proporção OFICIAL de banner do produto — `aspect-[1920/650]` casa o
// container com esse valor exato (não um arredondamento tipo aspect-video
// 16:9 ou aspect-[2/1], os dois ciclos anteriores neste mesmo componente).
// Nenhuma das 3 artes padrão hoje bate com essa proporção (medidas reais:
// home.png 1.874:1, vagas.png 2:1, clube.png 1.777:1) — todas vão sofrer
// recorte topo/base via object-cover (32-40%, ver relatório do bloco) até
// serem refeitas/recortadas para o padrão novo; isso é esperado e
// sinalizado, não um bug deste componente. `max-h-60` (240px) é um TETO de
// SEGURANÇA, não o dimensionador primário (essa foi a causa raiz do defeito
// original, pré-3.6): na largura máxima normal deste banner (max-w-2xl,
// 672px) a altura natural já fica em ~227px, abaixo do teto — o max-h só
// entraria em jogo se um `className` externo alargasse o container além de
// ~709px. `mx-auto` centraliza quando o pai é mais largo que o teto.
// Exportada (não só usada inline) para o teste unitário travar a proporção
// — não há infra de render de componente neste projeto (vitest roda em
// `environment: "node"`, sem jsdom/testing-library), então o teste verifica
// a string de classes em vez do DOM renderizado.
export const HOME_BANNER_IMAGE_CLASSNAME =
  "mx-auto aspect-[1920/650] h-auto w-full max-w-2xl max-h-60 rounded-[var(--radius-card)] border border-border object-cover";

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
