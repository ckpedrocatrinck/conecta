import { Card } from "@/components/ui/card";
import { POST_TYPE_LABEL } from "../../lib/posts/labels";
import { formatCalendarDate } from "../../lib/dates/format-date";
import type { FeedPostCard } from "../../lib/feed/build-feed-view";

function PersonAvatar({ fullName, photoUrl }: { fullName: string; photoUrl: string | null }) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- URL assinada, curta duracao
    return <img src={photoUrl} alt={fullName} className="size-8 rounded-full object-cover" />;
  }
  const initial = fullName.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-primary-subtle text-xs font-semibold text-primary">
      {initial}
    </span>
  );
}

/** Card basico do feed — layout final por template vem no INC-009. Nunca
 * confia num snapshot de foto: `photoUrl` ja chega null aqui quando a pessoa
 * esta com `photoVisible=false` (resolvido em toPostPersonView/buildFeedCards
 * a partir do estado ATUAL do consentimento, nao do momento da marcacao). */
export function PostCard({ post }: { post: FeedPostCard }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-primary">{POST_TYPE_LABEL[post.type] ?? post.type}</span>
        <span className="text-subtle-foreground">
          {formatCalendarDate(new Date(post.eventDate))}
          {post.branchName ? ` · ${post.branchName}` : ""}
        </span>
      </div>

      <h3 className="text-base font-bold text-foreground">{post.title}</h3>
      {post.body && <p className="text-sm text-foreground">{post.body}</p>}

      {post.people.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {post.people.map((person) => (
            <div key={person.userId} className="flex items-center gap-2">
              <PersonAvatar fullName={person.fullName} photoUrl={person.photoUrl} />
              <span className="text-sm text-foreground">{person.fullName}</span>
            </div>
          ))}
        </div>
      )}

      {post.media.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {post.media.map((media) => (
            // eslint-disable-next-line @next/next/no-img-element -- URL assinada, curta duracao
            <img key={media.id} src={media.viewUrl} alt="" className="size-20 rounded-lg object-cover" />
          ))}
        </div>
      )}
    </Card>
  );
}
