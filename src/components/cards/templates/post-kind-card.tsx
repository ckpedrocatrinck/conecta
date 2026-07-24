import type { ReactNode } from "react";
import { AvatarFallback } from "@/components/cards/avatar-fallback";
import { formatCalendarDate } from "@/lib/dates/format-date";
import { cardTitleFontSize, personNameFontSize } from "@/lib/cards/text-fit";
import type { PostCardData } from "@/lib/cards/card-model";
import { CardShell } from "./card-shell";

/** Reconhecimento, tempo de casa e promoção compartilham a mesma forma de
 * dado (PostCardData) — a diferença visual entre os 3 tipos vem do ícone e
 * rótulo do CardShell (por `kind`), não de 3 layouts distintos. */
export function PostKindCard({ data, footer }: { data: PostCardData; footer?: ReactNode }) {
  return (
    <CardShell
      kind={data.kind}
      branding={data.branding}
      footer={footer}
      meta={
        <span>
          {formatCalendarDate(new Date(data.eventDate))}
          {data.branchName ? ` · ${data.branchName}` : ""}
        </span>
      }
    >
      <h3
        className="break-words font-bold leading-tight text-foreground"
        style={{ fontSize: cardTitleFontSize(data.title) }}
      >
        {data.title}
      </h3>
      {data.body && <p className="text-sm text-foreground">{data.body}</p>}

      {data.people.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {data.people.map((person) => (
            <div key={person.fullName} className="flex items-center gap-2">
              <AvatarFallback fullName={person.fullName} photoUrl={person.photoUrl} size={32} />
              <span
                className="max-w-40 break-words text-foreground"
                style={{ fontSize: personNameFontSize(person.fullName) }}
              >
                {person.fullName}
              </span>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}
