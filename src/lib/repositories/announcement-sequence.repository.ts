import type { Prisma } from "@prisma/client";

/**
 * Atribui o proximo numero da sequencia tenant+ano via UPSERT atomico
 * (ON CONFLICT DO UPDATE serializa transacoes concorrentes na mesma linha —
 * nao precisa de SELECT ... FOR UPDATE nem advisory lock). So' e' realmente
 * a prova de corrida porque quem chama roda isto dentro da mesma transacao
 * `withTenant` que persiste o Announcement publicado (ver
 * src/lib/announcements/publish.ts) — a atribuicao do numero e a gravacao
 * do status "published" acontecem atomicamente juntas.
 */
export async function nextAnnouncementSequenceNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  year: number,
): Promise<number> {
  const rows = await tx.$queryRaw<{ last_number: number }[]>`
    INSERT INTO announcement_sequences (tenant_id, year, last_number)
    VALUES (${tenantId}::uuid, ${year}, 1)
    ON CONFLICT (tenant_id, year)
    DO UPDATE SET last_number = announcement_sequences.last_number + 1
    RETURNING last_number
  `;
  return rows[0].last_number;
}
