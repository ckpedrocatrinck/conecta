"use client";

import { Dialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

/** Thumbnail que abre a imagem ampliada num lightbox (sobreposicao). Reusa o
 * mesmo primitivo de dialog do ConfirmDialog (foco/escape/click-fora tratados
 * pelo base-ui). O `src` e' a URL assinada de curta duracao ja resolvida pelo
 * servidor. Usado no preview do post no admin (INC-016); reaproveitavel no feed. */
export function ImageLightbox({
  src,
  alt = "",
  className,
  triggerClassName,
  fullSrc,
}: {
  src: string;
  alt?: string;
  className?: string;
  /** Classe do botao-gatilho (ex.: `w-full` para imagem full-width no feed). */
  triggerClassName?: string;
  /** URL da imagem ampliada, se diferente do thumbnail (ex.: `/api/anexo/[id]`,
   * que re-assina no clique — robusto ao TTL curto do link). Default: `src`. */
  fullSrc?: string;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        aria-label="Ampliar imagem"
        className={cn(
          "block cursor-zoom-in rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-primary-subtle",
          triggerClassName,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada, curta duracao */}
        <img src={src} alt={alt} className={cn("object-cover", className)} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/70" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 outline-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada, curta duracao */}
          <img
            src={fullSrc ?? src}
            alt={alt}
            className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-[var(--shadow-card)]"
          />
          <Dialog.Close
            aria-label="Fechar"
            className="absolute -right-3 -top-3 flex size-8 items-center justify-center rounded-full bg-card text-lg leading-none text-foreground shadow-[var(--shadow-card)]"
          >
            ×
          </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
