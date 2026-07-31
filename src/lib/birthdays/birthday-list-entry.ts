/**
 * Forma de APRESENTACAO da lista de aniversariantes — modulo deliberadamente
 * PURO: nada aqui pode importar storage, banco, `node:*` ou qualquer coisa
 * server-only.
 *
 * Existe separado de `build-birthday-view.ts` por causa do DP-20: o client
 * component `birthday-search.tsx` precisa de `birthdayDayLabel` (um VALOR de
 * runtime, nao so' um tipo), e importa-lo de um modulo que tambem carrega
 * `mediaStorage` arrastava `node:fs/promises` para o chunk do cliente —
 * `next build` (Turbopack) falhava com "the chunking context (unknown) does
 * not support external modules". Cliente importa daqui; servidor importa de
 * `build-birthday-view.ts`.
 */
export type BirthdayListEntry = {
  userId: string;
  fullName: string;
  photoUrl: string | null;
  branchId: string;
  /** 0 = hoje (em America/Sao_Paulo), 1..N = dias a partir de hoje. */
  offsetDays: number;
  month: number;
  day: number;
};

/** Rotulo curto pra tela de aniversariantes ("claro em 30s" — design-system
 * §0). So' os 3 primeiros dias ganham rotulo relativo; do 4o em diante a data
 * numerica e' mais clara que "em 5 dias". */
export function birthdayDayLabel(offsetDays: number, month: number, day: number): string {
  if (offsetDays === 0) return "Hoje";
  if (offsetDays === 1) return "Amanhã";
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}
