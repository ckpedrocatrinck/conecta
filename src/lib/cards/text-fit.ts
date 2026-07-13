// Regra de fallback para nomes/titulos longos (criterio de aceite do
// INC-009: "card legivel com nomes de 40+ caracteres"). Nunca trunca com
// reticencias — perderia legibilidade no mural fisico impresso; em vez
// disso, reduz o tamanho da fonte para caber em ate 2 linhas com quebra de
// palavra. Retorna px (nao classe Tailwind) de proposito: o mesmo numero e'
// usado tanto no template nativo (style inline) quanto no satori (que so'
// entende estilo inline) — uma unica fonte de verdade, sem risco das duas
// implementacoes divergirem em qual "breakpoint" de tamanho usar.

function fitFontSize(text: string, { base, long, threshold }: { base: number; long: number; threshold: number }): number {
  return text.trim().length >= threshold ? long : base;
}

export function personNameFontSize(fullName: string): number {
  return fitFontSize(fullName, { base: 20, long: 15, threshold: 28 });
}

/** Variante do nome quando ele É o card (aniversariante) — precisa ser mais
 * proeminente que o rótulo ao lado de um avatar pequeno, mas segue a mesma
 * regra de redução para nome de 40+ caracteres. */
export function heroNameFontSize(fullName: string): number {
  return fitFontSize(fullName, { base: 32, long: 22, threshold: 28 });
}

export function cardTitleFontSize(title: string): number {
  return fitFontSize(title, { base: 26, long: 20, threshold: 55 });
}
