import Link from "next/link";
import { requireAdmin } from "../../../lib/auth/session";
import { withTenant } from "../../../lib/db/with-tenant";
import { findPostsForAdminList } from "../../../lib/repositories/post.repository";
import { POST_TYPE_LABEL } from "../../../lib/posts/labels";
import { formatCalendarDate } from "../../../lib/dates/format-date";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
};

export default async function PostsPage() {
  const session = await requireAdmin();

  const posts = await withTenant({ tenantId: session.tenantId }, (tx) => findPostsForAdminList(tx, session.tenantId));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Posts do feed</h1>
        <Link href="/admin/posts/novo" className="text-primary underline-offset-4 hover:underline">
          Novo post
        </Link>
      </div>

      {posts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum post criado ainda.</p>}

      <div className="flex flex-col gap-2">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/admin/posts/${post.id}`}
            className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-muted"
          >
            <span>
              {post.title} <span className="text-muted-foreground">({POST_TYPE_LABEL[post.type] ?? post.type})</span>
            </span>
            <span className="text-muted-foreground">
              {formatCalendarDate(post.eventDate)} · {post.branch?.name ?? "Geral"} · {STATUS_LABEL[post.status] ?? post.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
