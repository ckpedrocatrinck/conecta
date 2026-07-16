// Datas ficam em UTC no banco (padrao do projeto); conversao para
// America/Sao_Paulo so' na exibicao. Sem date-fns/dayjs no projeto —
// Intl.DateTimeFormat nativo e' suficiente, sem adicionar dependencia.
const formatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTimeSaoPaulo(date: Date): string {
  return formatter.format(date);
}

// A4-4 (auditoria 2026-07): o ano da sequencia CI NN/AAAA precisa ser o ano
// em America/Sao_Paulo, nao UTC — na janela ~21:00-23:59 BRT de 31/dez, UTC
// ja esta no ano seguinte (Brasil e' UTC-3), o que produziria "CI 01/AAAA+1"
// enquanto a organizacao ainda esta no ano anterior.
const yearFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
});

export function getSaoPauloYear(date: Date): number {
  return Number(yearFormatter.format(date));
}

// R23 (auditoria de usabilidade 2026-07): valor de um <input
// type="datetime-local"> (formato "YYYY-MM-DDTHH:mm", sem timezone) — usar
// no `defaultValue`/`value` pra pre-preencher com o horario de Sao Paulo em
// vez do UTC cru (`date.toISOString().slice(0,16)`), que aparecia deslocado
// em 3h ao reabrir o formulario de edicao.
const datetimeLocalFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function toDatetimeLocalSaoPaulo(date: Date): string {
  const parts = datetimeLocalFormatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
