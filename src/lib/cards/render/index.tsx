import { formatCalendarDate } from "../../dates/format-date";
import { cardTitleFontSize, heroNameFontSize, personNameFontSize } from "../text-fit";
import { BRAND_TOKENS } from "../brand-tokens";
import type { BirthdayCardData, CardData, JobOpeningCardData, PostCardData } from "../card-model";
import { CardImageShell } from "./card-image-shell";
import { AvatarNode } from "./avatar-node";

// Renderização satori dos 5 templates para a imagem exportável (rota
// /api/posts/[id]/card-image). Chame `withAbsoluteMediaUrls` (absolute-urls.ts)
// ANTES de passar o CardData aqui — satori busca imagens (foto/logo) por
// fetch e precisa de URL absoluta, diferente da versão nativa do feed.

function PostKindImage({ data }: { data: PostCardData }) {
  const meta = `${formatCalendarDate(new Date(data.eventDate))}${data.branchName ? ` · ${data.branchName}` : ""}`;

  return (
    <CardImageShell kind={data.kind} branding={data.branding} meta={meta}>
      <span style={{ fontSize: cardTitleFontSize(data.title), fontWeight: 700, color: BRAND_TOKENS.foreground }}>
        {data.title}
      </span>
      {data.body && <span style={{ fontSize: 18, color: BRAND_TOKENS.foreground }}>{data.body}</span>}
      {data.people.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
          {data.people.map((person) => (
            <div key={person.fullName} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <AvatarNode fullName={person.fullName} photoUrl={person.photoUrl} size={64} />
              <span
                style={{ fontSize: personNameFontSize(person.fullName), color: BRAND_TOKENS.foreground, maxWidth: 320 }}
              >
                {person.fullName}
              </span>
            </div>
          ))}
        </div>
      )}
    </CardImageShell>
  );
}

function BirthdayImage({ data }: { data: BirthdayCardData }) {
  return (
    <CardImageShell kind="birthday" branding={data.branding}>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <AvatarNode fullName={data.person.fullName} photoUrl={data.person.photoUrl} size={96} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span
            style={{
              fontSize: heroNameFontSize(data.person.fullName),
              fontWeight: 700,
              color: BRAND_TOKENS.foreground,
              maxWidth: 700,
            }}
          >
            {data.person.fullName}
          </span>
          <span style={{ fontSize: 20, color: BRAND_TOKENS.mutedForeground }}>Parabéns pelo seu dia!</span>
        </div>
      </div>
    </CardImageShell>
  );
}

function JobOpeningImage({ data }: { data: JobOpeningCardData }) {
  const meta = `Até ${formatCalendarDate(new Date(data.deadline))}${data.branchName ? ` · ${data.branchName}` : ""}${data.shift ? ` · Turno ${data.shift}` : ""}`;

  return (
    <CardImageShell kind="job_opening" branding={data.branding} meta={meta}>
      <span style={{ fontSize: cardTitleFontSize(data.title), fontWeight: 700, color: BRAND_TOKENS.foreground }}>
        {data.title}
      </span>
      <span style={{ fontSize: 18, color: BRAND_TOKENS.foreground }}>{data.description}</span>
    </CardImageShell>
  );
}

export function renderCardImage(data: CardData) {
  switch (data.kind) {
    case "recognition":
    case "tenure":
    case "promotion":
      return <PostKindImage data={data} />;
    case "birthday":
      return <BirthdayImage data={data} />;
    case "job_opening":
      return <JobOpeningImage data={data} />;
  }
}
