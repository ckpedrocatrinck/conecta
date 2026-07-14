import type { MonthDay } from "../dates/birthday-window";
import type { UpcomingBirthdayRow } from "../repositories/user.repository";
import type { TenantBranding } from "../repositories/tenant.repository";
import { mediaStorage } from "../storage/media-storage";
import { buildBirthdayCardData, type BirthdayCardData } from "../cards/card-model";

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

function offsetFor(row: { month: number; day: number }, monthDays: MonthDay[]): number {
  // A query (findUpcomingBirthdays) so' retorna linhas cujo (mes,dia) esta em
  // monthDays — findIndex sempre acha um match; o fallback so' existe para o
  // TypeScript, nunca deveria disparar na pratica.
  const idx = monthDays.findIndex((md) => md.month === row.month && md.day === row.day);
  return idx === -1 ? monthDays.length : idx;
}

/**
 * Resolve as linhas cruas do banco (ja' filtradas por `birthday_visible=true`
 * em `findUpcomingBirthdays` — nenhuma pessoa oculta chega aqui) para a forma
 * consumida pela tela/bloco: foto so' quando `photoVisible` (mesma regra de
 * `toPostPersonView`), ordenado por proximidade do aniversario e depois nome.
 */
export async function buildBirthdayListView(
  rows: UpcomingBirthdayRow[],
  monthDays: MonthDay[],
): Promise<BirthdayListEntry[]> {
  const entries = await Promise.all(
    rows.map(async (row) => ({
      userId: row.id,
      fullName: row.fullName,
      photoUrl: row.photoVisible && row.photoUrl ? await mediaStorage.getViewUrl(row.photoUrl) : null,
      branchId: row.branchId,
      offsetDays: offsetFor(row, monthDays),
      month: row.month,
      day: row.day,
    })),
  );

  return entries.sort((a, b) => a.offsetDays - b.offsetDays || a.fullName.localeCompare(b.fullName, "pt-BR"));
}

/** Rotulo curto pra tela de aniversariantes ("claro em 30s" — design-system
 * §0). So' os 3 primeiros dias ganham rotulo relativo; do 4o em diante a data
 * numerica e' mais clara que "em 5 dias". */
export function birthdayDayLabel(offsetDays: number, month: number, day: number): string {
  if (offsetDays === 0) return "Hoje";
  if (offsetDays === 1) return "Amanhã";
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

/** Card grande (template do INC-009) so' para quem faz aniversario HOJE — usa
 * exatamente o mesmo `BirthdayCardData` que o template ja consome, so' com
 * fonte real em vez da fixture de preview. `userId` volta junto so' para
 * servir de `key` estavel na lista (React) — nao faz parte do CardData. */
export function buildTodaysBirthdayCards(
  entries: BirthdayListEntry[],
  todayIso: string,
  branding: TenantBranding,
): { userId: string; card: BirthdayCardData }[] {
  return entries
    .filter((e) => e.offsetDays === 0)
    .map((e) => ({
      userId: e.userId,
      card: buildBirthdayCardData({ fullName: e.fullName, photoUrl: e.photoUrl }, todayIso, branding),
    }));
}
