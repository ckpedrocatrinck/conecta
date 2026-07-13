// Campos `@db.Date` (sem hora) — event_date, birth_date, hired_at — sao um
// dia de calendario, nao um instante. Ao contrario de timestamps (ver
// format-datetime.ts), NAO convertemos para America/Sao_Paulo: isso
// deslocaria a data (meia-noite UTC vira 21h do dia anterior em UTC-3) e
// mostraria o dia errado. Le-se os componentes UTC diretamente, mesmo
// padrao ja usado em toDateInputValue (admin/colaboradores/[id]/page.tsx).
export function formatCalendarDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}
