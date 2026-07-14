"use server";

import { requireOnboardedSession } from "../auth/session";
import { withTenant } from "../db/with-tenant";
import { findPostsForFeed } from "../repositories/post.repository";
import { buildFeedCards, FEED_PAGE_SIZE } from "./build-feed-view";

export async function loadMoreFeedPostsAction(cursor: { eventDate: string; createdAt: string; id: string }) {
  const session = await requireOnboardedSession();

  const posts = await withTenant({ tenantId: session.tenantId }, (tx) =>
    findPostsForFeed(tx, session.tenantId, {
      cursor: { eventDate: new Date(cursor.eventDate), createdAt: new Date(cursor.createdAt), id: cursor.id },
      limit: FEED_PAGE_SIZE,
    }),
  );

  return buildFeedCards(posts, session.userId);
}
