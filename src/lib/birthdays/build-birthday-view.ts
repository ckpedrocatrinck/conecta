import type { MonthDay } from "../dates/birthday-window";
import type { UpcomingBirthdayRow } from "../repositories/user.repository";
import type { TenantBranding } from "../repositories/tenant.repository";
import { mediaStorage } from "../storage/media-storage";
import { buildBirthdayCardData, type BirthdayCardData } from "../cards/card-model";
import type { BirthdayListEntry } from "./birthday-list-entry";

// SERVER-ONLY por construcao: `mediaStorage` acima puxa `node:fs/promises`.
// O tipo `BirthdayListEntry` e o helper de rotulo `birthdayDayLabel` moram em
// ./birthday-list-entry (modulo puro) justamente para que client components
// possam consumi-los sem arrastar esse grafo — ver DP-20. Nao reexportamos
// `birthdayDayLabel` daqui de proposito: reexportar reabriria a armadilha.
export type { BirthdayListEntry };

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
