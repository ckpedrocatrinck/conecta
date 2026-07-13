import { Card } from "@/components/ui/card";
import { CardTemplate } from "@/components/cards/templates";
import { AvatarFallback } from "@/components/cards/avatar-fallback";
import { buildPostCardData } from "@/lib/cards/card-model";
import type { TenantBranding } from "@/lib/repositories/tenant.repository";
import { POST_TYPE_LABEL } from "../../lib/posts/labels";
import { formatCalendarDate } from "../../lib/dates/format-date";
import type { FeedPostCard } from "../../lib/feed/build-feed-view";

/** Layout basico pre-INC-009, mantido so' para o tipo "general" (sem
 * template dedicado no escopo do INC-009/ADR-004). Nunca confia num
 * snapshot de foto: `photoUrl` ja chega null aqui quando a pessoa esta com
 * `photoVisible=false` (resolvido em toPostPersonView/buildFeedCards a
 * partir do estado ATUAL do consentimento, nao do momento da marcacao). */
function GeneralPostCard({ post }: { post: FeedPostCard }) {
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
              <AvatarFallback fullName={person.fullName} photoUrl={person.photoUrl} size={32} />
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

export function PostCard({ post, branding }: { post: FeedPostCard; branding: TenantBranding }) {
  const cardData = buildPostCardData(post, branding);
  if (!cardData) return <GeneralPostCard post={post} />;

  return (
    <div className="flex flex-col gap-2">
      <CardTemplate data={cardData} />
      {post.media.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {post.media.map((media) => (
            // eslint-disable-next-line @next/next/no-img-element -- URL assinada, curta duracao
            <img key={media.id} src={media.viewUrl} alt="" className="size-20 rounded-lg object-cover" />
          ))}
        </div>
      )}
    </div>
  );
}
