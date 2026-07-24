import { mediaStorage } from "@/lib/storage/media-storage";
import { sniffMediaType } from "@/lib/storage/media-sniff";
import { MAX_MEDIA_UPLOAD_BYTES } from "@/lib/storage/media-constraints";
import type { TenantBranding } from "@/lib/repositories/tenant.repository";

// INC-017: `findTenantBranding` devolve `logoUrl` como KEY de storage crua
// (contrato do repositorio — repositorio nunca assina, igual ao photoUrl). Quem
// vai RENDERIZAR resolve a key conforme o meio: assinatura de URL no browser,
// data URI no PNG exportavel. As duas estrategias moram aqui, lado a lado.

/** BROWSER (cards do feed, previews): assina a key do logo numa URL /api/media
 * de curta duracao — mesmo caminho do `photoUrl` em build-feed-view. O <img> do
 * card resolve relativo ao proprio host, que tem sessao + token. `accentColor`
 * passa direto (texto, nao depende de storage). */
export async function signBrandingForDisplay(branding: TenantBranding): Promise<TenantBranding> {
  return {
    ...branding,
    logoUrl: branding.logoUrl ? await mediaStorage.getViewUrl(branding.logoUrl) : null,
  };
}

/** EXPORT (PNG via satori/next-og): o render roda server-side SEM o cookie de
 * sessao, entao a URL assinada de /api/media nao serve (a rota exige sessao —
 * 401). Le os bytes do logo e embute como data URI, que o satori resolve inline
 * sem fetch autenticado. Logo e' imagem validada (<=5MB), entao o head cobre o
 * objeto inteiro. Devolve logoUrl=null se nao ha logo ou o objeto sumiu (o card
 * so' omite o logo — nunca quebra). */
export async function inlineBrandingLogoForExport(branding: TenantBranding): Promise<TenantBranding> {
  if (!branding.logoUrl) return branding;
  const head = await mediaStorage.readHead(branding.logoUrl, MAX_MEDIA_UPLOAD_BYTES);
  if (!head) return { ...branding, logoUrl: null };
  const sniff = sniffMediaType(head.bytes);
  if (!sniff) return { ...branding, logoUrl: null };
  return { ...branding, logoUrl: `data:${sniff.contentType};base64,${head.bytes.toString("base64")}` };
}
