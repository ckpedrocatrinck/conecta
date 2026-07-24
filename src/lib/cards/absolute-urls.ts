import type { CardData } from "./card-model";

function toAbsolute(url: string | null, origin: string): string | null {
  if (!url) return null;
  // URLs ja' absolutas ou auto-contidas (data URI — ex.: logo embutido para o
  // export, INC-017) passam intactas; so' as relativas ganham o origin.
  if (/^(https?:|data:)/i.test(url)) return url;
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** satori (motor por trás de `next/og`) busca imagens via fetch — precisa
 * de URL absoluta. As URLs de foto (MediaStorage) e de logo do tenant são
 * relativas ao host da aplicação; a versão nativa no feed não precisa disso
 * (o browser já resolve relativo ao próprio host) — só a rota de imagem
 * exportável passa por aqui, contra o `origin` da própria requisição. */
export function withAbsoluteMediaUrls(data: CardData, origin: string): CardData {
  const branding = { ...data.branding, logoUrl: toAbsolute(data.branding.logoUrl, origin) };

  switch (data.kind) {
    case "recognition":
    case "tenure":
    case "promotion":
      return {
        ...data,
        branding,
        people: data.people.map((person) => ({ ...person, photoUrl: toAbsolute(person.photoUrl, origin) })),
      };
    case "birthday":
      return { ...data, branding, person: { ...data.person, photoUrl: toAbsolute(data.person.photoUrl, origin) } };
    case "job_opening":
      return { ...data, branding };
  }
}
