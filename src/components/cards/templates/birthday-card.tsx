import { AvatarFallback } from "@/components/cards/avatar-fallback";
import { heroNameFontSize } from "@/lib/cards/text-fit";
import type { BirthdayCardData } from "@/lib/cards/card-model";
import { CardShell } from "./card-shell";

/** Template presentacional — sem wiring a dado real ainda (aniversariantes
 * é INC-010). Alimentado hoje só pela fixture de preview. */
export function BirthdayCard({ data }: { data: BirthdayCardData }) {
  return (
    <CardShell kind="birthday" branding={data.branding}>
      <div className="flex items-center gap-3">
        <AvatarFallback fullName={data.person.fullName} photoUrl={data.person.photoUrl} size={48} />
        <div className="flex flex-col">
          <span
            className="break-words font-bold leading-tight text-foreground"
            style={{ fontSize: heroNameFontSize(data.person.fullName) }}
          >
            {data.person.fullName}
          </span>
          <span className="text-sm text-muted-foreground">Parabéns pelo seu dia!</span>
        </div>
      </div>
    </CardShell>
  );
}
