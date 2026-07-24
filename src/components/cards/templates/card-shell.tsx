import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { CardShapeMotif } from "@/components/cards/card-shape";
import { CARD_KIND_ICON, CARD_KIND_LABEL } from "@/lib/cards/card-config";
import type { CardData } from "@/lib/cards/card-model";

/** Casca compartilhada pelos 5 templates nativos (feed + preview do admin):
 * cabecalho com icone/rotulo do tipo + logo do tenant, forma geometrica da
 * marca como textura, cor de destaque do tenant no acento — nunca no lugar
 * de `--action` (regra permanente do design-system, so' cor de acao real). */
export function CardShell({
  kind,
  branding,
  meta,
  footer,
  children,
}: {
  kind: CardData["kind"];
  branding: CardData["branding"];
  meta?: ReactNode;
  /** Conteudo extra DENTRO do mesmo card (INC-016): no feed, a imagem + o botao
   * de reacao entram aqui, para o card ler como UMA unidade (mesma borda/fundo)
   * em vez de blocos soltos. Opcional — o card-image (PNG) e o preview do admin
   * nao passam footer, entao seguem iguais. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const Icon = CARD_KIND_ICON[kind];

  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute right-0 top-0" aria-hidden="true">
        <CardShapeMotif color={branding.accentColor} />
      </div>

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex size-8 items-center justify-center rounded-full"
            style={{ backgroundColor: `${branding.accentColor}1F`, color: branding.accentColor }}
          >
            <Icon className="size-4" strokeWidth={2} />
          </span>
          <span className="text-xs font-semibold" style={{ color: branding.accentColor }}>
            {CARD_KIND_LABEL[kind]}
          </span>
        </div>
        {branding.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- asset publico de marca, nao pessoal
          <img src={branding.logoUrl} alt="" className="h-6 w-auto object-contain" />
        )}
      </div>

      <div className="relative flex flex-col gap-3">{children}</div>

      {meta && <div className="relative text-xs text-subtle-foreground">{meta}</div>}

      {footer && <div className="relative flex flex-col gap-3">{footer}</div>}
    </Card>
  );
}
