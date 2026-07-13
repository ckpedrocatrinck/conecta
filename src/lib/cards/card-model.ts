import type { FeedPostCard } from "../feed/build-feed-view";
import type { TenantBranding } from "../repositories/tenant.repository";
import { getAvatarColors, getInitial } from "./avatar";
import { DEFAULT_ACCENT_COLOR } from "./brand-tokens";

// Mapeia o dado ja resolvido do feed (foto ja filtrada por consentimento em
// toPostPersonView/buildFeedCards) para a forma normalizada consumida pelos
// templates de card — nativo (feed) e satori (imagem). NUNCA le photoUrl
// bruto de fora dessa funcao: quem chama e' responsavel por ja ter passado
// pela checagem de consentimento (contrato do INC-008).

export type CardPerson = {
  fullName: string;
  initial: string;
  photoUrl: string | null;
  avatarColor: { bg: string; fg: string };
};

export type CardBranding = { logoUrl: string | null; accentColor: string };

export type PostCardKind = "recognition" | "tenure" | "promotion";

export type PostCardData = {
  kind: PostCardKind;
  title: string;
  body: string | null;
  eventDate: string;
  branchName: string | null;
  people: CardPerson[];
  branding: CardBranding;
};

export type BirthdayCardData = {
  kind: "birthday";
  person: CardPerson;
  eventDate: string;
  branding: CardBranding;
};

export type JobOpeningCardData = {
  kind: "job_opening";
  title: string;
  description: string;
  shift: string | null;
  deadline: string;
  branchName: string | null;
  branding: CardBranding;
};

export type CardData = PostCardData | BirthdayCardData | JobOpeningCardData;

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function resolveAccentColor(accentColor: string | null): string {
  return accentColor && HEX_COLOR_RE.test(accentColor) ? accentColor : DEFAULT_ACCENT_COLOR;
}

export function toCardBranding(branding: TenantBranding): CardBranding {
  return { logoUrl: branding.logoUrl, accentColor: resolveAccentColor(branding.accentColor) };
}

export function toCardPerson(person: { fullName: string; photoUrl: string | null }): CardPerson {
  return {
    fullName: person.fullName,
    initial: getInitial(person.fullName),
    photoUrl: person.photoUrl,
    avatarColor: getAvatarColors(person.fullName),
  };
}

// Tipos com template dedicado neste INC — "general" mantem o layout basico
// pre-existente (nao esta no escopo do INC-009, ver ADR-004/INC-009).
const POST_CARD_KINDS = new Set<string>(["recognition", "tenure", "promotion"]);

export function isPostCardKind(type: string): type is PostCardKind {
  return POST_CARD_KINDS.has(type);
}

/** Retorna null para tipos sem template dedicado (ex.: "general") — quem
 * chama decide o fallback (layout basico do INC-008). */
export function buildPostCardData(post: FeedPostCard, branding: TenantBranding): PostCardData | null {
  if (!isPostCardKind(post.type)) return null;
  return {
    kind: post.type,
    title: post.title,
    body: post.body,
    eventDate: post.eventDate,
    branchName: post.branchName,
    people: post.people.map(toCardPerson),
    branding: toCardBranding(branding),
  };
}
