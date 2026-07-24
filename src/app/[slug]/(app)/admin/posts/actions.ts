"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import {
  createPostDraft,
  deletePostsByIds,
  findPristineDraftsByAdmin,
} from "@/lib/repositories/post.repository";
import { recordAuditLog } from "@/lib/repositories/audit-log.repository";

/**
 * "Novo post" (INC-016 / auto-rascunho — solucao TEMPORARIA, ver DP-19): em vez
 * de um formulario que so' cria no submit, cria/reaproveita um rascunho e leva
 * direto a tela de compor (edicao), onde a secao Anexos ja' existe — assim o
 * admin anexa imagem/PDF na mesma tela em que escreve (a chave do storage
 * precisa do postId, que so' existe depois do rascunho nascer).
 *
 * Tratamento de orfaos (so' DB, nao depende do R2): reusa o rascunho pristine
 * mais recente deste admin e APAGA os pristine extras — garante no maximo 1
 * scaffold por admin, sem sweep agendado. Pristine nao tem midia, entao nao ha'
 * objeto no storage a limpar.
 */
export async function createOrReuseDraftAction() {
  const session = await requireAdmin();

  const postId = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const pristine = await findPristineDraftsByAdmin(tx, session.tenantId, session.userId);
    if (pristine.length > 0) {
      const [keep, ...extras] = pristine;
      await deletePostsByIds(
        tx,
        session.tenantId,
        extras.map((p) => p.id),
      );
      return keep.id;
    }

    const post = await createPostDraft(tx, {
      tenantId: session.tenantId,
      type: "recognition",
      title: "",
      body: null,
      // NOT NULL no schema — placeholder de hoje; o admin ajusta antes de publicar
      // (publishPostAction exige titulo, e a data e' editavel na tela de compor).
      eventDate: new Date(),
      branchId: null,
      createdBy: session.userId,
    });
    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "post.create",
      entity: "Post",
      entityId: post.id,
      metadata: { auto: true },
    });
    return post.id;
  });

  redirect(`/${session.tenantSlug}/admin/posts/${postId}`);
}
