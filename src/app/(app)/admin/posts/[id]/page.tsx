import { notFound } from "next/navigation";
import { requireAdmin } from "../../../../../lib/auth/session";
import { withTenant } from "../../../../../lib/db/with-tenant";
import { findBranchesByTenant } from "../../../../../lib/repositories/branch.repository";
import { findPostWithDetails, findUsersForPersonPicker } from "../../../../../lib/repositories/post.repository";
import { findTenantBranding } from "../../../../../lib/repositories/tenant.repository";
import { resolvePickablePeoplePhotos } from "../../../../../lib/posts/resolve-pickable-people";
import { isPostCardKind } from "../../../../../lib/cards/card-model";
import { mediaStorage } from "../../../../../lib/storage/media-storage";
import { EditPostForm } from "./form";
import { PostPhotoUpload } from "./photo-upload";
import { publishPostAction } from "./actions";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

const ERROR_MESSAGES: Record<string, string> = {
  obrigatorio: "Preencha tipo, título e data do evento.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  publicado: "Post publicado.",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
};

export default async function PostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; salvo?: string; ok?: string }>;
}) {
  const session = await requireAdmin();
  const { id } = await params;
  const { erro, salvo, ok } = await searchParams;

  const [data, branding] = await Promise.all([
    withTenant({ tenantId: session.tenantId }, async (tx) => {
      const post = await findPostWithDetails(tx, session.tenantId, id);
      if (!post) return null;
      const [branches, rawPeople] = await Promise.all([
        findBranchesByTenant(tx, session.tenantId),
        findUsersForPersonPicker(tx, session.tenantId),
      ]);
      return { post, branches, rawPeople };
    }),
    findTenantBranding(session.tenantId),
  ]);

  if (!data) notFound();
  const { post, branches, rawPeople } = data;
  const people = await resolvePickablePeoplePhotos(rawPeople);

  const existingMedia = await Promise.all(
    post.media.map(async (m) => ({ id: m.id, viewUrl: await mediaStorage.getViewUrl(m.mediaUrl) })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {post.title} <span className="text-sm font-normal text-muted-foreground">({STATUS_LABEL[post.status]})</span>
        </h1>
        <div className="flex items-center gap-2">
          {isPostCardKind(post.type) && (
            <a href={`/api/posts/${post.id}/card-image`} download={`card-${post.id}.png`}>
              <Button type="button" variant="secondary">
                Baixar card
              </Button>
            </a>
          )}
          {post.status === "draft" && (
            <form action={publishPostAction}>
              <input type="hidden" name="id" value={post.id} />
              <SubmitButton pendingLabel="Publicando…">Publicar</SubmitButton>
            </form>
          )}
        </div>
      </div>

      {erro && ERROR_MESSAGES[erro] && (
        <p role="alert" className="text-sm text-destructive">
          {ERROR_MESSAGES[erro]}
        </p>
      )}
      {salvo === "ok" && <p className="text-sm text-success">Alterações salvas.</p>}
      {ok && SUCCESS_MESSAGES[ok] && <p className="text-sm text-success">{SUCCESS_MESSAGES[ok]}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Fotos</h2>
        <PostPhotoUpload postId={post.id} existingMedia={existingMedia} />
      </section>

      <EditPostForm
        post={post}
        branches={branches}
        people={people}
        selectedPersonIds={post.people.map((p) => p.userId)}
        branding={branding}
      />
    </div>
  );
}
