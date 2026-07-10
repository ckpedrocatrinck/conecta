import { NextRequest, NextResponse } from "next/server";
import { runScheduledAnnouncementSweep } from "../../../../lib/announcements/scheduled-sweep";

/**
 * Disparado periodicamente por um cron externo (config do host, fora deste
 * repo). Autenticado por segredo compartilhado — nao ha' sessao de usuario
 * nesse contexto. `CRON_SECRET` documentado no .env.example.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET nao configurado" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runScheduledAnnouncementSweep();
  return NextResponse.json({ publishedCount: result.published.length });
}
