import type { ReactNode } from "react";
import type { CardData } from "@/lib/cards/card-model";
import { PostKindCard } from "./post-kind-card";
import { BirthdayCard } from "./birthday-card";
import { JobOpeningCard } from "./job-opening-card";

/** `footer` (INC-016) so' se aplica aos cards de post (recognition/tenure/
 * promotion) — no feed carrega imagem + reacao DENTRO do card. Birthday/job
 * ignoram. */
export function CardTemplate({ data, footer }: { data: CardData; footer?: ReactNode }) {
  switch (data.kind) {
    case "recognition":
    case "tenure":
    case "promotion":
      return <PostKindCard data={data} footer={footer} />;
    case "birthday":
      return <BirthdayCard data={data} />;
    case "job_opening":
      return <JobOpeningCard data={data} />;
  }
}
