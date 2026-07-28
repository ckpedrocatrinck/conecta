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

// Offset real de Sao Paulo num instante, lido da tabela de fusos do ICU em
// vez de fixado em -180: o Brasil nao tem horario de verao desde 2019, mas a
// regra e' dado externo e pode voltar.
const offsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  timeZoneName: "longOffset",
});

function saoPauloOffsetMinutes(instant: Date): number {
  const name = offsetFormatter.formatToParts(instant).find((p) => p.type === "timeZoneName")?.value ?? "";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return -180;
  return (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
}

const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Inverso de `toDatetimeLocalSaoPaulo` (INC-018 item 5): recebe o valor cru
 * de um `<input type="datetime-local">` — "YYYY-MM-DDTHH:mm", sem fuso — e
 * devolve o instante UTC correspondente aquele horario de PAREDE em
 * America/Sao_Paulo, que e' o que o admin digitou e o que vai pro banco.
 *
 * `new Date(valor)` NAO serve aqui: sem sufixo de fuso, o ECMAScript
 * interpreta a string como horario local do PROCESSO — em runtime serverless
 * (TZ=UTC) "agendar para 08:00" gravaria 08:00Z = 05:00 em SP, 3h adiantado
 * do que o admin viu na tela.
 *
 * Devolve `null` para formato invalido ou para data que nao existe
 * ("2026-02-30"), verificado por round-trip com o formatador de exibicao.
 */
export function fromDatetimeLocalSaoPaulo(value: string): Date | null {
  const match = DATETIME_LOCAL_RE.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;

  const wallClockAsUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  if (Number.isNaN(wallClockAsUtc)) return null;

  // Duas passadas: a 1a mede o offset com um chute (o horario de parede
  // tratado como se fosse UTC), a 2a remede no instante ja corrigido — cobre
  // a borda em que o chute cai do outro lado de uma mudanca de offset.
  const firstGuess = new Date(wallClockAsUtc - saoPauloOffsetMinutes(new Date(wallClockAsUtc)) * 60_000);
  const result = new Date(wallClockAsUtc - saoPauloOffsetMinutes(firstGuess) * 60_000);
  if (Number.isNaN(result.getTime())) return null;

  // Round-trip: se o horario de parede resolvido nao bate com o digitado, a
  // data nao existe (30/fev virou 02/mar) ou caiu num buraco de fuso.
  if (toDatetimeLocalSaoPaulo(result) !== `${year}-${month}-${day}T${hour}:${minute}`) return null;

  return result;
}
