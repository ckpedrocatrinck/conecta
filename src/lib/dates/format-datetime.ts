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
