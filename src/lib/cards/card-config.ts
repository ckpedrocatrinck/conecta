import { Award, Briefcase, Cake, CalendarClock, TrendingUp } from "lucide-react";
import type { CardData } from "./card-model";

export const CARD_KIND_LABEL: Record<CardData["kind"], string> = {
  recognition: "Reconhecimento",
  tenure: "Tempo de casa",
  promotion: "Promoção",
  birthday: "Aniversário",
  job_opening: "Vaga aberta",
};

export const CARD_KIND_ICON: Record<CardData["kind"], typeof Award> = {
  recognition: Award,
  tenure: CalendarClock,
  promotion: TrendingUp,
  birthday: Cake,
  job_opening: Briefcase,
};
