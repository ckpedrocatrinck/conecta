// Aniversariantes (INC-010) sao query sobre `User.birth_date` (@db.Date, sem
// hora — le-se por componentes UTC, mesma convencao de format-date.ts). Mas
// "hoje" e' um INSTANTE real (Date.now()), e o unico jeito de saber que dia
// civil isso e' em America/Sao_Paulo e' converter esse instante para o fuso
// ANTES de extrair o dia — nunca usar getUTCDate() do `now` direto, ou a
// virada de dia erra em ate 3h (ex.: 01:00 UTC de um dia D e' ainda 22h do
// dia D-1 em SP).
const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SAO_PAULO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type MonthDay = { month: number; day: number };

/** Dia civil (Y-M-D) em SP do instante `now`, como um `Date` em meia-noite
 * UTC — representa o DIA, nao um instante, mesmo padrao usado em
 * birth_date/event_date no resto do projeto. So' este ponto de entrada
 * converte fuso; a partir daqui e' so' aritmetica de calendario em UTC. */
function todayInSaoPauloAsUtcDate(now: Date): Date {
  const [{ value: year }, , { value: month }, , { value: day }] = ymdFormatter.formatToParts(now);
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

/** Janela de `days+1` dias (hoje + proximos `days`) como pares (mes,dia),
 * ancorada no dia civil de SP. Virada de ano (dez->jan) nao precisa de
 * tratamento especial: cada par e' comparado por igualdade, independente do
 * ano. */
export function birthdayWindowMonthDays(now: Date, days: number): MonthDay[] {
  const anchor = todayInSaoPauloAsUtcDate(now);
  const window: MonthDay[] = [];

  for (let offset = 0; offset <= days; offset++) {
    const d = new Date(anchor);
    d.setUTCDate(d.getUTCDate() + offset);
    window.push({ month: d.getUTCMonth() + 1, day: d.getUTCDate() });
  }

  return window;
}
