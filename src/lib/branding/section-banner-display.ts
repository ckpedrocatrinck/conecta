import { mediaStorage } from "@/lib/storage/media-storage";

// INC-019 (banner por secao): resolucao key -> src das duas secoes com tela
// (Vagas, Beneficios), mesmo padrao inline ja usado pela home (ver page.tsx da
// home) — centralizado aqui so' porque cada secao tem 2 telas (colaborador +
// admin) que precisam do mesmo calculo.

const VAGAS_BANNER_FALLBACK = "/banners/vagas.png";

/** Vagas tem arte fixa: sem key do tenant, cai no asset publico existente
 * (nao e' "sem banner", e' o banner padrao do produto). */
export async function resolveVagasBannerSrc(key: string | null): Promise<string> {
  return key ? await mediaStorage.getViewUrl(key) : VAGAS_BANNER_FALLBACK;
}

/** Beneficios NAO tem arte fixa propria (decisao de escopo do INC-019): sem
 * key do tenant, devolve undefined — o HomeBanner cai no bloco de texto, nunca
 * numa imagem generica de outra secao. */
export async function resolveBeneficiosBannerSrc(key: string | null): Promise<string | undefined> {
  return key ? await mediaStorage.getViewUrl(key) : undefined;
}
