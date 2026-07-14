"use server";

import { Prisma } from "@prisma/client";
import { requireOnboardedSession } from "../auth/session";
import { withTenant } from "../db/with-tenant";
import {
  addPostReaction,
  countPostReactions,
  findPostReaction,
  removePostReaction,
} from "../repositories/post.repository";

function isUniqueConstraintViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Toggle de reacao (INC-010): liga se nao existe, desliga se ja existe.
 * Idempotencia tem 3 camadas — UI (botao desabilitado durante a chamada,
 * ver ReactionButton), esta funcao (check-then-act) e o backstop de banco
 * abaixo: se dois toques quase simultaneos passarem pelo check "nao existe"
 * antes de qualquer um commitar, a segunda `create` colide na PK composta
 * (post_id, user_id) — capturada aqui como P2002 e tratada como no-op (o
 * resultado pratico e' o mesmo: a reacao existe), nunca propagada como erro
 * pro usuario por causa de uma corrida que ele nem percebeu.
 */
export async function togglePostReactionAction(postId: string): Promise<{ reacted: boolean; count: number }> {
  const session = await requireOnboardedSession();

  return withTenant({ tenantId: session.tenantId }, async (tx) => {
    const existing = await findPostReaction(tx, session.tenantId, postId, session.userId);

    if (existing) {
      await removePostReaction(tx, session.tenantId, postId, session.userId);
    } else {
      try {
        await addPostReaction(tx, session.tenantId, postId, session.userId);
      } catch (err) {
        if (!isUniqueConstraintViolation(err)) throw err;
      }
    }

    const count = await countPostReactions(tx, session.tenantId, postId);
    return { reacted: !existing, count };
  });
}
