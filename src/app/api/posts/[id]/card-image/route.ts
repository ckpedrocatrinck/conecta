import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { getActiveSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { findPostWithDetails } from "@/lib/repositories/post.repository";
import { findTenantBranding } from "@/lib/repositories/tenant.repository";
import { buildFeedCards } from "@/lib/feed/build-feed-view";
import { buildPostCardData } from "@/lib/cards/card-model";
import { withAbsoluteMediaUrls } from "@/lib/cards/absolute-urls";
import { inlineBrandingLogoForExport } from "@/lib/branding/branding-display";
import { renderCardImage } from "@/lib/cards/render";
import { CARD_IMAGE_HEIGHT, CARD_IMAGE_WIDTH } from "@/lib/cards/render/card-image-shell";
import { CARD_FONTS } from "@/lib/cards/render/fonts";

/**
 * Imagem compartilhável do card (botão "baixar card", INC-009) — server-side
 * via `next/og` (satori+resvg embutidos no Next.js, sem dependência nova,
 * ver decisão técnica no Relatório de Entrega). Autenticado + escopado ao
 * tenant do contexto (regra 7 do CLAUDE.md, mesmo padrão de /api/media/[key]):
 * colaborador de qualquer papel pode ver a imagem de um post PUBLICADO
 * (mesma visibilidade do feed); rascunho só para admin do mesmo tenant.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const session = await getActiveSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const result = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const post = await findPostWithDetails(tx, session.tenantId, id);
    if (!post) return null;
    if (post.status !== "published" && session.role !== "admin") return "forbidden" as const;

    const [feedCard] = await buildFeedCards([post], session.userId);
    const branding = await findTenantBranding(session.tenantId);
    return { feedCard, branding };
  });

  if (result === null) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (result === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Logo embutido como data URI: satori roda sem cookie, entao a URL assinada
  // de /api/media nao serve aqui (INC-017). O <img> do card nativo, no browser,
  // usa a URL assinada normal — so' o export precisa deste tratamento.
  const brandingForExport = await inlineBrandingLogoForExport(result.branding);
  const cardData = buildPostCardData(result.feedCard, brandingForExport);
  if (!cardData) {
    return NextResponse.json({ error: "este tipo de post não tem card gerado" }, { status: 400 });
  }

  const absoluteCardData = withAbsoluteMediaUrls(cardData, request.nextUrl.origin);

  return new ImageResponse(renderCardImage(absoluteCardData), {
    width: CARD_IMAGE_WIDTH,
    height: CARD_IMAGE_HEIGHT,
    fonts: CARD_FONTS,
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
