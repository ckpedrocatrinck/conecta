import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { findPostsForAdminList } from "@/lib/repositories/post.repository";
import { mediaStorage } from "@/lib/storage/media-storage";
import { PostCover } from "@/components/admin/post-cover";
import { POST_TYPE_LABEL } from "@/lib/posts/labels";
import { formatCalendarDate } from "@/lib/dates/format-date";
import { createOrReuseDraftAction } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
};

export default async function PostsPage() {
  const session = await requireAdmin();

  const rawPosts = await withTenant({ tenantId: session.tenantId }, (tx) => findPostsForAdminList(tx, session.tenantId));
  // Assina a URL da capa (primeira imagem) de cada post — chave crua nunca vai
  // ao cliente (contrato de storage do INC-003).
  const posts = await Promise.all(
    rawPosts.map(async (post) => ({
      ...post,
      coverUrl: post.media[0] ? await mediaStorage.getViewUrl(post.media[0].mediaUrl) : null,
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-display text-foreground">Posts do feed</h1>
          <p className="text-meta text-muted-foreground">
            Reconhecimentos, avisos e cards automáticos exibidos aos colaboradores.
          </p>
        </div>
        {/* Auto-rascunho (INC-016): cria/reaproveita um rascunho e leva direto a
            tela de compor — que ja' tem a secao Anexos. Ver createOrReuseDraftAction. */}
        <form action={createOrReuseDraftAction}>
          <SubmitButton size="touch" pendingLabel="Abrindo…">
            <Plus aria-hidden="true" />
            Novo post
          </SubmitButton>
        </form>
      </div>

      {posts.length === 0 ? (
        <p className="text-meta text-muted-foreground">Nenhum post criado ainda.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/${session.tenantSlug}/admin/posts/${post.id}`}
              className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-muted"
            >
              {post.coverUrl && <PostCover src={post.coverUrl} />}
              <div className="flex items-center justify-between gap-2">
                <Badge variant="label">{POST_TYPE_LABEL[post.type] ?? post.type}</Badge>
                <span className="text-meta text-subtle-foreground">{formatCalendarDate(post.eventDate)}</span>
              </div>
              <span className="text-card-title font-bold text-foreground">{post.title || "Rascunho sem título"}</span>
              <div className="flex items-center justify-between gap-2 text-meta text-muted-foreground">
                <span>{STATUS_LABEL[post.status] ?? post.status}</span>
                <span>{post.branch?.name ?? "Geral"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
