import { describe, expect, it } from "vitest";
import { retentionCutoff } from "./anonymize-sweep";

describe("retentionCutoff (puro, UTC)", () => {
  it("subtrai os meses em UTC", () => {
    const now = new Date("2026-07-23T12:00:00.000Z");
    expect(retentionCutoff(now, 24).toISOString()).toBe("2024-07-23T12:00:00.000Z");
    expect(retentionCutoff(now, 0).toISOString()).toBe("2026-07-23T12:00:00.000Z");
  });

  it("rola o ano corretamente ao atravessar janeiro", () => {
    const now = new Date("2026-01-15T00:00:00.000Z");
    expect(retentionCutoff(now, 2).toISOString()).toBe("2025-11-15T00:00:00.000Z");
    expect(retentionCutoff(now, 13).toISOString()).toBe("2024-12-15T00:00:00.000Z");
  });

  it("nao muta o argumento", () => {
    const now = new Date("2026-07-23T12:00:00.000Z");
    retentionCutoff(now, 24);
    expect(now.toISOString()).toBe("2026-07-23T12:00:00.000Z");
  });
});
