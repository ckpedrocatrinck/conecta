const BRAZIL_COUNTRY_CODE = "55";
const MIN_DIGITS_FOR_LINK = 10;

export type WhatsappContact = { waLink: string } | { waLink: null };

/** Telefone e' texto livre digitado no cadastro (mascara, espacos, parenteses
 * variam) — normaliza pra wa.me: so' digitos, prefixa 55 se faltar. Numero
 * com menos de 10 digitos (antes do prefixo) e' curto demais pra ser um
 * DDD+numero valido — sinaliza sem link em vez de gerar um wa.me morto. */
export function normalizeWhatsappNumber(phone: string): WhatsappContact {
  const rawDigits = phone.replace(/\D/g, "");
  if (rawDigits.length < MIN_DIGITS_FOR_LINK) {
    return { waLink: null };
  }

  const digits = rawDigits.startsWith(BRAZIL_COUNTRY_CODE) ? rawDigits : `${BRAZIL_COUNTRY_CODE}${rawDigits}`;
  return { waLink: `https://wa.me/${digits}` };
}
