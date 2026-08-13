import type { AnnouncementCriticality } from "@prisma/client";

export type AnnouncementVersionLite = {
  id: string;
  versionNumber: number;
  isMaterialChange: boolean;
};

export type AnnouncementReaderBadge = "novo" | "confirmar_leitura" | "confirmado" | "lido";

export type AnnouncementReaderState<V extends AnnouncementVersionLite = AnnouncementVersionLite> = {
  requiredVersionNumber: number;
  latestVersion: V;
  readSatisfied: boolean;
  ackSatisfied: boolean;
  /** true quando `requires_ack` e ainda sem ack valido para a versao exigida
   * (nunca aberto OU reaberto por versao material) — usado pelo banner. */
  awaitingAck: boolean;
  /** true quando o usuario ja tinha confirmado ciencia antes, mas uma versao
   * material publicada depois invalidou esse ack — mostra o aviso "este
   * comunicado foi atualizado" na tela de leitura. */
  wasReopened: boolean;
  badge: AnnouncementReaderBadge;
  lastAckedAt?: Date;
  /** Numero da versao do ack que satisfaz a exigencia hoje (INC-027 bloco
   * 3.12) — pode ser MENOR que `latestVersion.versionNumber`: uma edicao
   * NAO-material publicada depois do ack nao reabre pendencia (regra do
   * modelo), mas o conteudo exibido na tela ja mudou desde a confirmacao.
   * A tela de leitura usa isso pra avisar quando o que foi confirmado nao e'
   * mais, ao pe da letra, o texto atual. */
  lastAckedVersionNumber?: number;
};

/**
 * requiredVersionNumber = a versao que precisa ter sido confirmada/lida para
 * a ciencia estar satisfeita: a primeira versao publicada (piso, sempre 1),
 * OU a mais recente marcada `isMaterialChange`, o que for maior. Implementa
 * literalmente a regra do modelo de dados: edicao NAO-material nunca reabre
 * pendencia (o maximo nao muda); edicao marcada material avanca o piso, e
 * qualquer ack/leitura anterior a ela deixa de satisfazer. Usar `max` (nao
 * "a ultima versao material") garante que um ack entre dois saltos materiais
 * continua corretamente insatisfeito frente ao segundo salto.
 */
export function computeRequiredAckVersionNumber(versions: AnnouncementVersionLite[]): number {
  const materialMax = versions.reduce((max, v) => (v.isMaterialChange && v.versionNumber > max ? v.versionNumber : max), 0);
  return Math.max(1, materialMax);
}

export function buildAnnouncementReaderState<V extends AnnouncementVersionLite>(input: {
  criticality: AnnouncementCriticality;
  versions: V[];
  reads: { versionId: string }[];
  acks: { versionId: string; ackedAt: Date }[];
}): AnnouncementReaderState<V> {
  if (input.versions.length === 0) {
    throw new Error("buildAnnouncementReaderState: announcement sem nenhuma versao");
  }

  const versionNumberById = new Map(input.versions.map((v) => [v.id, v.versionNumber]));
  const requiredVersionNumber = computeRequiredAckVersionNumber(input.versions);
  const latestVersion = input.versions.reduce((latest, v) => (v.versionNumber > latest.versionNumber ? v : latest));

  const readSatisfied = input.reads.some((r) => (versionNumberById.get(r.versionId) ?? -1) >= requiredVersionNumber);

  const satisfyingAcks = input.acks.filter((a) => (versionNumberById.get(a.versionId) ?? -1) >= requiredVersionNumber);
  const ackSatisfied = satisfyingAcks.length > 0;
  const hadPriorAck = input.acks.length > 0;

  const awaitingAck = input.criticality === "requires_ack" && !ackSatisfied;
  const wasReopened = awaitingAck && hadPriorAck;

  const badge: AnnouncementReaderBadge =
    input.criticality === "requires_ack"
      ? ackSatisfied
        ? "confirmado"
        : readSatisfied
          ? "confirmar_leitura"
          : "novo"
      : readSatisfied
        ? "lido"
        : "novo";

  const mostRecentSatisfyingAck = [...satisfyingAcks].sort((a, b) => b.ackedAt.getTime() - a.ackedAt.getTime())[0];
  const lastAckedAt = mostRecentSatisfyingAck?.ackedAt;
  const lastAckedVersionNumber = mostRecentSatisfyingAck ? versionNumberById.get(mostRecentSatisfyingAck.versionId) : undefined;

  return {
    requiredVersionNumber,
    latestVersion,
    readSatisfied,
    ackSatisfied,
    awaitingAck,
    wasReopened,
    badge,
    lastAckedAt,
    lastAckedVersionNumber,
  };
}
