"use client";

import { CardTemplate } from "@/components/cards/templates";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { isPostCardKind, toCardBranding, toCardPerson } from "@/lib/cards/card-model";
import type { TenantBranding } from "@/lib/repositories/tenant.repository";
import type { PickablePerson } from "./post-people-picker";

export type PreviewImage = { id: string; viewUrl: string | null };

/**
 * Preview do card no formulário do admin, ANTES de publicar (critério de
 * aceite do INC-009). Roda 100% client-side com o dado já em memória (sem
 * round-trip ao servidor) — usa o MESMO `CardTemplate` do feed, então o que
 * o admin vê aqui é pixel-a-pixel o que vai aparecer publicado. `people` já
 * chega com a regra de consentimento aplicada (ver resolvePickablePeoplePhotos),
 * então o preview nunca mostra foto de quem não consente, igual ao card real.
 */
export function PostCardPreview({
  type,
  title,
  body,
  selectedPeople,
  branding,
  images = [],
}: {
  type: string;
  title: string;
  body: string;
  selectedPeople: PickablePerson[];
  branding: TenantBranding;
  /** Imagens ja anexadas (URLs assinadas resolvidas no servidor). Aparecem no
   * preview como no feed real; clicar amplia no lightbox (INC-016). */
  images?: PreviewImage[];
}) {
  const previewImages = images.filter((i) => i.viewUrl);
  const attachments =
    previewImages.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {previewImages.map((img) => (
          <ImageLightbox key={img.id} src={img.viewUrl as string} className="size-20 rounded-lg" />
        ))}
      </div>
    ) : null;

  if (!isPostCardKind(type)) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview do post</p>
        <p className="text-sm text-muted-foreground">
          Post do tipo &quot;Geral&quot; não tem card gerado — usa o layout básico do feed.
        </p>
        {attachments}
      </div>
    );
  }

  const data = {
    kind: type,
    title: title.trim() || "Título do post",
    body: body.trim() ? body : null,
    eventDate: new Date().toISOString(),
    branchName: null,
    people: selectedPeople.map((p) => toCardPerson({ fullName: p.fullName, photoUrl: p.photoUrl })),
    branding: toCardBranding(branding),
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview do card</p>
      <CardTemplate data={data} />
      {attachments}
    </div>
  );
}
