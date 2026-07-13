import type { CardData } from "@/lib/cards/card-model";
import { PostKindCard } from "./post-kind-card";
import { BirthdayCard } from "./birthday-card";
import { JobOpeningCard } from "./job-opening-card";

export function CardTemplate({ data }: { data: CardData }) {
  switch (data.kind) {
    case "recognition":
    case "tenure":
    case "promotion":
      return <PostKindCard data={data} />;
    case "birthday":
      return <BirthdayCard data={data} />;
    case "job_opening":
      return <JobOpeningCard data={data} />;
  }
}
