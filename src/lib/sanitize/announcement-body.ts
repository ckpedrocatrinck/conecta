import sanitizeHtml from "sanitize-html";

// Allowlist minima do editor (ADR-001 / regra do design-system: nunca
// renderizar HTML nao sanitizado). So' os recursos do escopo do INC-004:
// negrito, italico, listas, links. Nada de scripts, estilos, imagens,
// tabelas ou atributos alem de href.
const ALLOWED_TAGS = ["p", "br", "strong", "em", "b", "i", "ul", "ol", "li", "a"];

export function sanitizeAnnouncementBody(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
    disallowedTagsMode: "discard",
  });
}

/**
 * "Tem corpo de verdade?" — checado SEMPRE sobre o HTML ja' sanitizado
 * (INC-018 item 4: validacao de publicacao nunca confia no cliente). Um
 * `body.trim().length > 0` cru nao serve: o editor devolve "<p></p>" quando o
 * admin nao digitou nada, e um corpo que era so' `<script>` fica como string
 * nao-vazia de tags apos a sanitizacao.
 */
export function announcementBodyHasContent(sanitizedHtml: string): boolean {
  const text = sanitizedHtml
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0;
}
