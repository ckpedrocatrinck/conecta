import { beforeEach, describe, expect, it } from "vitest";
import { __resetRateLimitStore, isRateLimited, recordAttempt } from "./rate-limit";

// INC-013 G5 — limiter fixed-window em memoria. `now` injetado para nao depender
// de relogio real.
const OPTS = { limit: 3, windowMs: 10_000 };

beforeEach(() => __resetRateLimitStore());

describe("rate-limit (fixed-window em memoria)", () => {
  it("permite ate' o limite e bloqueia a partir do limite+1 na janela", () => {
    const t = 1_000_000;
    expect(isRateLimited("k", OPTS, t)).toBe(false);
    recordAttempt("k", OPTS, t); // 1
    recordAttempt("k", OPTS, t); // 2
    expect(isRateLimited("k", OPTS, t)).toBe(false); // 2 < 3
    recordAttempt("k", OPTS, t); // 3
    expect(isRateLimited("k", OPTS, t)).toBe(true); // 3 >= 3
  });

  it("zera apos a janela expirar", () => {
    const t = 1_000_000;
    recordAttempt("k", OPTS, t);
    recordAttempt("k", OPTS, t);
    recordAttempt("k", OPTS, t);
    expect(isRateLimited("k", OPTS, t)).toBe(true);
    // Passou a janela: conta reinicia.
    const later = t + OPTS.windowMs + 1;
    expect(isRateLimited("k", OPTS, later)).toBe(false);
    recordAttempt("k", OPTS, later);
    expect(isRateLimited("k", OPTS, later)).toBe(false);
  });

  it("chaves diferentes (IPs) nao se afetam", () => {
    const t = 1_000_000;
    recordAttempt("a", OPTS, t);
    recordAttempt("a", OPTS, t);
    recordAttempt("a", OPTS, t);
    expect(isRateLimited("a", OPTS, t)).toBe(true);
    expect(isRateLimited("b", OPTS, t)).toBe(false);
  });

  it("peek nao incrementa (so' recordAttempt conta)", () => {
    const t = 1_000_000;
    for (let i = 0; i < 10; i++) isRateLimited("k", OPTS, t);
    expect(isRateLimited("k", OPTS, t)).toBe(false); // nenhum record ainda
  });
});
