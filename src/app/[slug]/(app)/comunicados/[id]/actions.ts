"use server";

import { redirect } from "next/navigation";
import { requireOnboardedSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { findAnnouncementById, isAnnouncementVisibleToUser } from "@/lib/repositories/announcement.repository";
import { findAnnouncementVersionScoped } from "@/lib/repositories/announcement-version.repository";
import { createAnnouncementAckIdempotent } from "@/lib/repositories/announcement-ack.repository";

/**
 * Declarar ciencia. Duas revalidacoes obrigatorias (nao boas-praticas: sem
 * elas ha' um buraco real de integridade probatoria — ver plano do INC-005):
 * 1. `isAnnouncementVisibleToUser` de novo aqui, nao so' no GET da tela de
 *    leitura/lista — sem isso, um usuario que descubra o UUID de um
 *    comunicado restrito a outra filial poderia gravar um ack valido nele.
 * 2. `findAnnouncementVersionScoped` — AnnouncementAck tem `announcementId`
 *    e `versionId` como FKs independentes, sem constraint composta no banco
 *    ligando uma a outra. Sem essa checagem, nada impede um ack com
 *    announcementId de um comunicado e versionId de outro.
 *
 * O hash gravado (`contentHashAtAck`) e' sempre o `contentHash` JA
 * PERSISTIDO da versao (imutavel, nunca recalculado aqui) — e' isso que
 * garante que o hash e' o da versao que a pessoa viu na tela, mesmo que uma
 * versao nova tenha sido publicada entre a exibicao e o clique.
 */
export async function ackAnnouncementAction(formData: FormData) {
  const session = await requireOnboardedSession();
  const announcementId = String(formData.get("announcementId") ?? "");
  const versionId = String(formData.get("versionId") ?? "");

  if (!announcementId || !versionId) redirect(`/${session.tenantSlug}/comunicados`);

  await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const visible = await isAnnouncementVisibleToUser(tx, session.tenantId, session.userId, announcementId);
    if (!visible) return;

    const announcement = await findAnnouncementById(tx, session.tenantId, announcementId);
    if (!announcement || announcement.criticality !== "requires_ack") return;

    const version = await findAnnouncementVersionScoped(tx, session.tenantId, announcementId, versionId);
    if (!version) return;

    await createAnnouncementAckIdempotent(tx, {
      tenantId: session.tenantId,
      announcementId,
      versionId,
      userId: session.userId,
      contentHashAtAck: version.contentHash,
    });
  });

  redirect(`/${session.tenantSlug}/comunicados/${announcementId}`);
}
