import { NextResponse } from "next/server";
import { getActiveSession } from "../../../../lib/auth/session";
import { withTenant } from "../../../../lib/db/with-tenant";
import { findPostMediaById } from "../../../../lib/repositories/post.repository";
import { mediaStorage } from "../../../../lib/storage/media-storage";

/**
 * Abertura de anexo por id (INC-016) — usado pelo card de documento (PDF) e pelo
 * "abrir imagem" do feed. Re-assina a view URL no momento do clique e redireciona
 * (302), para o link nunca chegar expirado por causa do TTL curto (o feed pode
 * ficar aberto mais que o TTL). O acesso continua sendo o contrato de /api/media:
 * a busca do PostMedia roda sob withTenant (RLS por tenant), entao um anexo de
 * outro tenant simplesmente nao e' encontrado (404) — nao ha URL publica.
 */
export async function GET(_request: Request, context: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await context.params;

  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const media = await withTenant({ tenantId: session.tenantId }, (tx) =>
    findPostMediaById(tx, session.tenantId, mediaId),
  );
  if (!media) return NextResponse.json({ error: "not found" }, { status: 404 });

  const viewUrl = await mediaStorage.getViewUrl(media.mediaUrl);
  // viewUrl e' um caminho relativo (/api/media/...). O 302 resolve contra a
  // origem atual; a /api/media revalida sessao + autz + token.
  return NextResponse.redirect(new URL(viewUrl, _request.url), 302);
}
