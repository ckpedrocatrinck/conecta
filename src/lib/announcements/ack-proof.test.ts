import { describe, expect, it } from "vitest";
import { buildAckProofView, describeAckInterval } from "./ack-proof";

describe("describeAckInterval — intervalo legivel entre publicacao e ciencia (INC-027 bloco 3.12)", () => {
  it("menos de 1 minuto", () => {
    const publishAt = new Date("2026-08-14T08:00:00Z");
    const ackedAt = new Date("2026-08-14T08:00:30Z");
    expect(describeAckInterval(publishAt, ackedAt)).toBe("menos de 1 minuto depois");
  });

  it("minutos, com plural correto", () => {
    const publishAt = new Date("2026-08-14T08:00:00Z");
    expect(describeAckInterval(publishAt, new Date("2026-08-14T08:01:00Z"))).toBe("1 minuto depois");
    expect(describeAckInterval(publishAt, new Date("2026-08-14T08:45:00Z"))).toBe("45 minutos depois");
  });

  it("horas, com plural correto", () => {
    const publishAt = new Date("2026-08-14T08:00:00Z");
    expect(describeAckInterval(publishAt, new Date("2026-08-14T09:00:00Z"))).toBe("1 hora depois");
    expect(describeAckInterval(publishAt, new Date("2026-08-14T14:00:00Z"))).toBe("6 horas depois");
  });

  it("dias, com plural correto", () => {
    const publishAt = new Date("2026-08-01T08:00:00Z");
    expect(describeAckInterval(publishAt, new Date("2026-08-02T08:00:00Z"))).toBe("1 dia depois");
    expect(describeAckInterval(publishAt, new Date("2026-08-15T08:00:00Z"))).toBe("14 dias depois");
  });

  it("meses (aproximado em blocos de 30 dias), com plural correto", () => {
    const publishAt = new Date("2026-06-01T08:00:00Z");
    expect(describeAckInterval(publishAt, new Date("2026-07-01T08:00:00Z"))).toBe("1 mês depois");
    expect(describeAckInterval(publishAt, new Date("2026-09-01T08:00:00Z"))).toBe("3 meses depois");
  });

  it("intervalo negativo (ack antes da publicacao, base corrompida/sintetica) devolve null — omitir em vez de errar", () => {
    const publishAt = new Date("2026-08-14T08:00:00Z");
    const ackedAt = new Date("2026-08-14T07:00:00Z");
    expect(describeAckInterval(publishAt, ackedAt)).toBeNull();
  });

  it("instante identico (0ms) e' 'menos de 1 minuto', nao null", () => {
    const instant = new Date("2026-08-14T08:00:00Z");
    expect(describeAckInterval(instant, instant)).toBe("menos de 1 minuto depois");
  });
});

describe("buildAckProofView — versao confirmada vs versao atual (INC-027 bloco 3.12)", () => {
  it("ack na versao mais recente: confirmedOnEarlierVersion e' false", () => {
    const view = buildAckProofView({
      publishAt: new Date("2026-08-01T08:00:00Z"),
      ackedAt: new Date("2026-08-01T09:00:00Z"),
      ackedVersionNumber: 2,
      latestVersionNumber: 2,
    });
    expect(view.confirmedOnEarlierVersion).toBe(false);
    expect(view.ackedVersionNumber).toBe(2);
    expect(view.latestVersionNumber).toBe(2);
  });

  it("ack numa versao anterior (edicao nao-material publicada depois): confirmedOnEarlierVersion e' true", () => {
    const view = buildAckProofView({
      publishAt: new Date("2026-08-01T08:00:00Z"),
      ackedAt: new Date("2026-08-01T09:00:00Z"),
      ackedVersionNumber: 1,
      latestVersionNumber: 2,
    });
    expect(view.confirmedOnEarlierVersion).toBe(true);
  });

  it("propaga o intervalo calculado", () => {
    const view = buildAckProofView({
      publishAt: new Date("2026-08-01T08:00:00Z"),
      ackedAt: new Date("2026-08-02T08:00:00Z"),
      ackedVersionNumber: 1,
      latestVersionNumber: 1,
    });
    expect(view.intervalLabel).toBe("1 dia depois");
  });
});
