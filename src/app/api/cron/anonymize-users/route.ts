import { NextRequest, NextResponse } from "next/server";
import { runAnonymizationSweep } from "../../../../lib/users/anonymize-sweep";

/**
 * Anonimizacao de desligados vencidos (INC-013 G1 / ADR-006 §3), disparada pelo
 * cron externo — mesma auth bearer-secret (`CRON_SECRET`) do sweep de
 * comunicados, sem sessao de usuario.
 *
 * SEGURO POR PADRAO: a anonimizacao e' IRREVERSIVEL, entao so' executa de fato
 * com `?mode=execute` explicito. Sem o parametro (ou com qualquer outro valor) a
 * rota roda em DRY-RUN — reporta a lista de quem SERIA anonimizado sem escrever
 * nada. Uma chamada acidental/mal-configurada nunca destroi dado; o cron real e'
 * configurado deliberadamente com `?mode=execute`.
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

  const dryRun = request.nextUrl.searchParams.get("mode") !== "execute";
  const result = await runAnonymizationSweep({ dryRun });

  return NextResponse.json({
    mode: result.mode,
    candidateCount: result.candidates.length,
    anonymizedCount: result.anonymized.length,
    candidates: result.candidates,
    anonymized: result.anonymized,
  });
}
