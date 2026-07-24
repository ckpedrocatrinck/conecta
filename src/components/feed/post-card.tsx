import { Card } from "@/components/ui/card";
import { CardTemplate } from "@/components/cards/templates";
import { AvatarFallback } from "@/components/cards/avatar-fallback";
import { buildPostCardData } from "@/lib/cards/card-model";
import type { TenantBranding } from "@/lib/repositories/tenant.repository";
import { POST_TYPE_LABEL } from "../../lib/posts/labels";
import { formatCalendarDate } from "../../lib/dates/format-date";
import type { FeedPostCard } from "../../lib/feed/build-feed-view";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { DocumentAttachmentCard } from "./document-attachment-card";
import { ReactionButton } from "./reaction-button";

/** Anexos do post no feed. Imagens em aspecto NATURAL (Solucao B): 1 imagem
 * ocupa a largura do card e a altura acompanha a proporcao, com teto de 75vh
 * (foto muito vertical nao vira card gigante — corte suave so' no limite);
 * 2+ imagens viram uma grade 2-col de miniaturas. Qualquer imagem abre no
 * lightbox pelo /api/anexo (re-assina no clique, robusto ao TTL). Documentos
 * (PDF) seguem como card de documento. Empilhado, cabe em 360px. */
function PostAttachments({ post }: { post: FeedPostCard }) {
  const images = post.media.filter((m) => m.kind === "image" && m.viewUrl);
  const documents = post.media.filter((m) => m.kind === "document");
  if (images.length === 0 && documents.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {images.length === 1 && (
        <ImageLightbox
          src={images[0].viewUrl as string}
          fullSrc={`/api/anexo/${images[0].id}`}
          triggerClassName="w-full"
          // Teto 90vh: foto de pessoas tipica (~3:4, 9:16 moderado) cabe inteira.
          // object-top: no extremo que excede o teto, o corte come a BASE, nunca
          // o topo — regra de ouro do feed de reconhecimento: nao cortar cabeca.
          className="max-h-[90vh] w-full rounded-lg object-top"
        />
      )}
      {images.length > 1 && (
        <div className="grid grid-cols-2 gap-1">
          {images.map((media) => (
            <ImageLightbox
              key={media.id}
              src={media.viewUrl as string}
              fullSrc={`/api/anexo/${media.id}`}
              triggerClassName="aspect-square w-full"
              // object-top pela mesma regra: a miniatura quadrada corta a base,
              // nunca a cabeca.
              className="size-full rounded-lg object-top"
            />
          ))}
        </div>
      )}
      {documents.map((media) => (
        <DocumentAttachmentCard key={media.id} attachment={media} />
      ))}
    </div>
  );
}

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

      <PostAttachments post={post} />

      <ReactionButton postId={post.id} initialReacted={post.reactedByMe} initialCount={post.reactionCount} />
    </Card>
  );
}

export function PostCard({ post, branding }: { post: FeedPostCard; branding: TenantBranding }) {
  const cardData = buildPostCardData(post, branding);
  if (!cardData) return <GeneralPostCard post={post} />;

  return (
    <div className="flex flex-col gap-2">
      <CardTemplate data={cardData} />
      <PostAttachments post={post} />
      <ReactionButton postId={post.id} initialReacted={post.reactedByMe} initialCount={post.reactionCount} />
    </div>
  );
}
