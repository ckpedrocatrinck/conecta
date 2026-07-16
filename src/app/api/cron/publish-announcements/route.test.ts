import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import * as scheduledSweep from "../../../../lib/announcements/scheduled-sweep";

function requestWithAuth(authHeader?: string) {
  return new NextRequest("http://localhost/api/cron/publish-announcements", {
    headers: authHeader ? { authorization: authHeader } : undefined,
  });
}

describe("GET /api/cron/publish-announcements", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("rejeita sem Authorization header (401) — mesmo contrato que o middleware precisa deixar alcancavel", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-teste");
    const response = await GET(requestWithAuth());
    expect(response.status).toBe(401);
  });

  it("rejeita com secret errado (401)", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-teste");
    const response = await GET(requestWithAuth("Bearer secret-errado"));
    expect(response.status).toBe(401);
  });

  it("aceita com o secret certo e roda o sweep (200)", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-teste");
    vi.spyOn(scheduledSweep, "runScheduledAnnouncementSweep").mockResolvedValue({ published: [] });

    const response = await GET(requestWithAuth("Bearer segredo-teste"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ publishedCount: 0 });
  });
});
