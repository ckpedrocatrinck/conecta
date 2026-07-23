import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import * as anonymizeSweep from "../../../../lib/users/anonymize-sweep";

function request(url: string, authHeader?: string) {
  return new NextRequest(url, { headers: authHeader ? { authorization: authHeader } : undefined });
}

const URL_BASE = "http://localhost/api/cron/anonymize-users";

describe("GET /api/cron/anonymize-users", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("rejeita sem Authorization header (401)", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-teste");
    const response = await GET(request(URL_BASE));
    expect(response.status).toBe(401);
  });

  it("rejeita com secret errado (401)", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-teste");
    const response = await GET(request(URL_BASE, "Bearer secret-errado"));
    expect(response.status).toBe(401);
  });

  it("SEM ?mode roda em DRY-RUN (seguro por padrao)", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-teste");
    const spy = vi
      .spyOn(anonymizeSweep, "runAnonymizationSweep")
      .mockResolvedValue({ mode: "dry-run", candidates: [], anonymized: [] });

    const response = await GET(request(URL_BASE, "Bearer segredo-teste"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledWith({ dryRun: true });
    expect(body.mode).toBe("dry-run");
  });

  it("com ?mode=qualquer-outra-coisa ainda e' DRY-RUN (so' 'execute' executa)", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-teste");
    const spy = vi
      .spyOn(anonymizeSweep, "runAnonymizationSweep")
      .mockResolvedValue({ mode: "dry-run", candidates: [], anonymized: [] });

    await GET(request(`${URL_BASE}?mode=preview`, "Bearer segredo-teste"));
    expect(spy).toHaveBeenCalledWith({ dryRun: true });
  });

  it("com ?mode=execute roda de verdade (dryRun:false)", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-teste");
    const spy = vi
      .spyOn(anonymizeSweep, "runAnonymizationSweep")
      .mockResolvedValue({ mode: "execute", candidates: [], anonymized: [] });

    const response = await GET(request(`${URL_BASE}?mode=execute`, "Bearer segredo-teste"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledWith({ dryRun: false });
    expect(body.mode).toBe("execute");
  });
});
