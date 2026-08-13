/**
 * Intervalo legivel em pt-BR entre publicacao e confirmacao de ciencia
 * (INC-027 bloco 3.12) — e' o que torna visivel, sem o leitor precisar
 * comparar duas datas de cabeca, a tese do ADR-001 (provar o INTERVALO entre
 * a informacao ficar disponivel e a confirmacao, nao so' que ela ocorreu).
 * Aproximacao de mes = 30 dias (mesma convencao de "X meses atras" comum em
 * UI) — nao precisa de calendario exato pra ser util aqui. `null` quando o
 * intervalo e' negativo (ack antes da publicacao nao deveria acontecer pelo
 * fluxo real do produto, mas se acontecer numa base corrompida/sintetica,
 * omitir e' melhor que exibir algo sem sentido).
 */
export function describeAckInterval(publishAt: Date, ackedAt: Date): string | null {
  const diffMs = ackedAt.getTime() - publishAt.getTime();
  if (diffMs < 0) return null;

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "menos de 1 minuto depois";
  if (minutes < 60) return `${minutes} minuto${minutes === 1 ? "" : "s"} depois`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hora${hours === 1 ? "" : "s"} depois`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} dia${days === 1 ? "" : "s"} depois`;

  const months = Math.floor(days / 30);
  return `${months} ${months === 1 ? "mês" : "meses"} depois`;
}

export type AckProofView = {
  intervalLabel: string | null;
  ackedVersionNumber: number;
  latestVersionNumber: number;
  /** true quando uma edicao (nao-material, por definicao — material
   * reabriria a pendencia) mudou o conteudo depois desta confirmacao. A tela
   * usa isso pra avisar que o texto exibido hoje ja nao e', ao pe da letra, o
   * que a pessoa confirmou. */
  confirmedOnEarlierVersion: boolean;
};

export function buildAckProofView(input: {
  publishAt: Date;
  ackedAt: Date;
  ackedVersionNumber: number;
  latestVersionNumber: number;
}): AckProofView {
  return {
    intervalLabel: describeAckInterval(input.publishAt, input.ackedAt),
    ackedVersionNumber: input.ackedVersionNumber,
    latestVersionNumber: input.latestVersionNumber,
    confirmedOnEarlierVersion: input.ackedVersionNumber < input.latestVersionNumber,
  };
}
