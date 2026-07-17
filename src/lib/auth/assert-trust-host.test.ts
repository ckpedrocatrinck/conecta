import { afterEach, describe, expect, it } from "vitest";
import { assertAuthTrustHostConfigured } from "./assert-trust-host";

const TRUST_ENV_KEYS = ["NODE_ENV", "VERCEL", "CF_PAGES", "AUTH_TRUST_HOST", "AUTH_URL"] as const;

describe("assertAuthTrustHostConfigured", () => {
  const original: Record<string, string | undefined> = {};

  const mutableEnv = process.env as Record<string, string | undefined>;

  afterEach(() => {
    for (const key of TRUST_ENV_KEYS) {
      if (original[key] === undefined) delete mutableEnv[key];
      else mutableEnv[key] = original[key];
    }
  });

  function setEnv(values: Partial<Record<(typeof TRUST_ENV_KEYS)[number], string>>) {
    for (const key of TRUST_ENV_KEYS) {
      original[key] = mutableEnv[key];
      delete mutableEnv[key];
    }
    for (const [key, value] of Object.entries(values)) {
      mutableEnv[key] = value;
    }
  }

  it("nao faz nada fora de producao, mesmo sem nenhuma env var de trust host", () => {
    setEnv({ NODE_ENV: "development" });
    expect(() => assertAuthTrustHostConfigured()).not.toThrow();
  });

  it("falha em producao sem VERCEL, CF_PAGES, AUTH_TRUST_HOST nem AUTH_URL", () => {
    setEnv({ NODE_ENV: "production" });
    expect(() => assertAuthTrustHostConfigured()).toThrow(/AUTH_TRUST_HOST/);
  });

  it("passa em producao com VERCEL definido", () => {
    setEnv({ NODE_ENV: "production", VERCEL: "1" });
    expect(() => assertAuthTrustHostConfigured()).not.toThrow();
  });

  it("passa em producao com CF_PAGES definido", () => {
    setEnv({ NODE_ENV: "production", CF_PAGES: "1" });
    expect(() => assertAuthTrustHostConfigured()).not.toThrow();
  });

  it("passa em producao com AUTH_TRUST_HOST definido", () => {
    setEnv({ NODE_ENV: "production", AUTH_TRUST_HOST: "true" });
    expect(() => assertAuthTrustHostConfigured()).not.toThrow();
  });

  it("passa em producao com AUTH_URL definido", () => {
    setEnv({ NODE_ENV: "production", AUTH_URL: "https://conecta.exemplo.com" });
    expect(() => assertAuthTrustHostConfigured()).not.toThrow();
  });
});
