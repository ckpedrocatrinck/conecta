import type { Prisma } from "@prisma/client";
import { toPostPersonView } from "../repositories/post.repository";
import { mediaStorage } from "../storage/media-storage";

export const FEED_PAGE_SIZE = 10;

type FeedPostWithRelations = Prisma.PostGetPayload<{
  include: {
    branch: { select: { id: true; name: true } };
    people: { include: { user: { select: { id: true; fullName: true; photoUrl: true; photoVisible: true } } } };
    media: true;
  };
}>;

export type FeedPostCard = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  eventDate: string;
  createdAt: string;
  branchName: string | null;
  people: { userId: string; fullName: string; label: string | null; photoUrl: string | null }[];
  media: { id: string; viewUrl: string }[];
};

/** Resolve as chaves de midia (foto de pessoa + fotos do post) para URLs
 * assinadas de curta duracao — nunca expor a chave crua nem uma URL publica
 * (contrato de storage do INC-003). Roda so' no servidor (usa mediaStorage). */
export async function buildFeedCards(posts: FeedPostWithRelations[]): Promise<FeedPostCard[]> {
  return Promise.all(
    posts.map(async (post) => {
      const people = await Promise.all(
        post.people.map(async (p) => {
          const view = toPostPersonView(p);
          return { ...view, photoUrl: view.photoUrl ? await mediaStorage.getViewUrl(view.photoUrl) : null };
        }),
      );
      const media = await Promise.all(
        post.media.map(async (m) => ({ id: m.id, viewUrl: await mediaStorage.getViewUrl(m.mediaUrl) })),
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
      };
    }),
  );
}
