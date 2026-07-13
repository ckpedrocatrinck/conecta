import { formatCalendarDate } from "@/lib/dates/format-date";
import { cardTitleFontSize } from "@/lib/cards/text-fit";
import type { JobOpeningCardData } from "@/lib/cards/card-model";
import { CardShell } from "./card-shell";

/** Template presentacional — sem wiring a dado real ainda (vagas/candidatura
 * é INC-011, fase 4). Alimentado hoje só pela fixture de preview. */
export function JobOpeningCard({ data }: { data: JobOpeningCardData }) {
  return (
    <CardShell
      kind="job_opening"
      branding={data.branding}
      meta={
        <span>
          Até {formatCalendarDate(new Date(data.deadline))}
          {data.branchName ? ` · ${data.branchName}` : ""}
          {data.shift ? ` · Turno ${data.shift}` : ""}
        </span>
      }
    >
      <h3
        className="break-words font-bold leading-tight text-foreground"
        style={{ fontSize: cardTitleFontSize(data.title) }}
      >
        {data.title}
      </h3>
      <p className="text-sm text-foreground">{data.description}</p>
    </CardShell>
  );
}
