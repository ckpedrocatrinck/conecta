"use client";

import { CardTemplate } from "@/components/cards/templates";
import { isPostCardKind, toCardBranding, toCardPerson } from "@/lib/cards/card-model";
import type { TenantBranding } from "@/lib/repositories/tenant.repository";
import type { PickablePerson } from "./post-people-picker";

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
}: {
  type: string;
  title: string;
  body: string;
  selectedPeople: PickablePerson[];
  branding: TenantBranding;
}) {
  if (!isPostCardKind(type)) {
    return (
      <p className="text-sm text-muted-foreground">
        Post do tipo &quot;Geral&quot; não tem card gerado — usa o layout básico do feed.
      </p>
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
    </div>
  );
}
