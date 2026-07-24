import type { Prisma } from "@prisma/client";
import { toPostPersonView } from "../repositories/post.repository";
import { mediaStorage } from "../storage/media-storage";

export const FEED_PAGE_SIZE = 10;

type FeedPostWithRelations = Prisma.PostGetPayload<{
  include: {
    branch: { select: { id: true; name: true } };
    people: { include: { user: { select: { id: true; fullName: true; photoUrl: true; photoVisible: true } } } };
    media: true;
    reactions: { select: { userId: true } };
  };
}>;

export type FeedAttachment = {
  id: string;
  kind: "image" | "document";
  // URL assinada de curta duracao para o thumbnail inline — so' imagem. Documento
  // (PDF) nao renderiza inline: o card de documento abre via /api/anexo/[id], que
  // re-assina no clique (evita 403 por expiracao do link depois de rolar o feed).
  viewUrl: string | null;
  originalName: string | null;
  sizeBytes: number | null;
  mimeType: string | null;
};

export type FeedPostCard = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  eventDate: string;
  createdAt: string;
  branchName: string | null;
  people: { userId: string; fullName: string; label: string | null; photoUrl: string | null }[];
  media: FeedAttachment[];
  reactionCount: number;
  reactedByMe: boolean;
};

/** Resolve as chaves de midia (foto de pessoa + fotos do post) para URLs
 * assinadas de curta duracao — nunca expor a chave crua nem uma URL publica
 * (contrato de storage do INC-003). Roda so' no servidor (usa mediaStorage).
 * `currentUserId` so' decide `reactedByMe` (INC-010) — a lista completa de
 * `reactions` ja veio do banco (POST_DETAIL_INCLUDE), sem query extra. */
export async function buildFeedCards(posts: FeedPostWithRelations[], currentUserId: string): Promise<FeedPostCard[]> {
  return Promise.all(
    posts.map(async (post) => {
      const people = await Promise.all(
        post.people.map(async (p) => {
          const view = toPostPersonView(p);
          return { ...view, photoUrl: view.photoUrl ? await mediaStorage.getViewUrl(view.photoUrl) : null };
        }),
      );
      const media: FeedAttachment[] = await Promise.all(
        post.media.map(async (m) => ({
          id: m.id,
          kind: m.kind,
          // So' imagem carrega thumbnail inline; documento abre via /api/anexo.
          viewUrl: m.kind === "image" ? await mediaStorage.getViewUrl(m.mediaUrl) : null,
          originalName: m.originalName,
          sizeBytes: m.sizeBytes,
          mimeType: m.mimeType,
        })),
      );

      return {
        id: post.id,
        type: post.type,
        title: post.title,
        body: post.body,
        eventDate: post.eventDate.toISOString(),
        createdAt: post.createdAt.toISOString(),
        branchName: post.branch?.name ?? null,
        people,
        media,
        reactionCount: post.reactions.length,
        reactedByMe: post.reactions.some((r) => r.userId === currentUserId),
      };
    }),
  );
}
