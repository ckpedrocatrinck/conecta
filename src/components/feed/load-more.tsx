"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PostCard } from "./post-card";
import { loadMoreFeedPostsAction } from "../../lib/feed/actions";
import type { FeedPostCard } from "../../lib/feed/build-feed-view";
import type { TenantBranding } from "../../lib/repositories/tenant.repository";

type Cursor = { eventDate: string; createdAt: string; id: string };

/** Botao "carregar mais" (nao scroll infinito — ver justificativa no
 * Relatorio de Entrega do INC-008): concatena paginas no estado local sem
 * IntersectionObserver rodando o tempo todo em aparelho modesto. `branding`
 * e' constante por tenant/sessao — passada do server, nao refeita a cada
 * pagina. */
export function FeedLoadMore({
  initialCursor,
  pageSize,
  branding,
}: {
  initialCursor: Cursor | null;
  pageSize: number;
  branding: TenantBranding;
}) {
  const [posts, setPosts] = useState<FeedPostCard[]>([]);
  const [cursor, setCursor] = useState<Cursor | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleLoadMore() {
    if (!cursor) return;
    setLoading(true);
    setError(false);
    try {
      const next = await loadMoreFeedPostsAction(cursor);
      setPosts((prev) => [...prev, ...next]);
      const last = next.at(-1);
      setCursor(next.length < pageSize || !last ? null : { eventDate: last.eventDate, createdAt: last.createdAt, id: last.id });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} branding={branding} />
      ))}
      {cursor && (
        <Button type="button" variant="outline" size="touch" onClick={handleLoadMore} disabled={loading} className="self-center">
          {loading ? "Carregando…" : "Carregar mais"}
        </Button>
      )}
      {error && (
        <p className="self-center text-sm text-destructive">Não foi possível carregar mais. Tente novamente.</p>
      )}
    </>
  );
}
