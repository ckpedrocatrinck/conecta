import type { Prisma, PostType } from "@prisma/client";

export function findPostsByTenant(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.post.findMany({ where: { tenantId } });
}

export function findPostById(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.post.findFirst({ where: { id, tenantId } });
}

/** Lista do admin (mais recentes primeiro) — sem paginacao no MVP, mesmo
 * padrao de findAuditLogsForTenant/findAnnouncementsForAdminList. */
export function findPostsForAdminList(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.post.findMany({
    where: { tenantId },
    include: { branch: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

const POST_DETAIL_INCLUDE = {
  branch: { select: { id: true, name: true } },
  people: {
    include: { user: { select: { id: true, fullName: true, photoUrl: true, photoVisible: true } } },
  },
  media: { orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.PostInclude;

/** Post com pessoas/midia/filial para tela de edicao e para o card do feed.
 * A foto de cada pessoa e' resolvida em `toPostPersonView` a partir do
 * `photoVisible` ATUAL do usuario — nunca de um snapshot tirado na marcacao. */
export function findPostWithDetails(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.post.findFirst({ where: { id, tenantId }, include: POST_DETAIL_INCLUDE });
}

export type NewPostData = {
  tenantId: string;
  type: PostType;
  title: string;
  body?: string | null;
  eventDate: Date;
  branchId?: string | null;
  createdBy: string;
};

export function createPostDraft(tx: Prisma.TransactionClient, data: NewPostData) {
  return tx.post.create({
    data: {
      tenantId: data.tenantId,
      type: data.type,
      title: data.title,
      body: data.body ?? null,
      eventDate: data.eventDate,
      branchId: data.branchId ?? null,
      createdBy: data.createdBy,
      status: "draft",
    },
  });
}

export type PostFieldsUpdate = {
  type: PostType;
  title: string;
  body?: string | null;
  eventDate: Date;
  branchId?: string | null;
};

export function updatePostFields(tx: Prisma.TransactionClient, tenantId: string, id: string, data: PostFieldsUpdate) {
  return tx.post.updateMany({
    where: { id, tenantId },
    data: {
      type: data.type,
      title: data.title,
      body: data.body ?? null,
      eventDate: data.eventDate,
      branchId: data.branchId ?? null,
    },
  });
}

/** draft -> published e' a unica transicao (sem caminho de volta no MVP). */
export function publishPost(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.post.updateMany({ where: { id, tenantId, status: "draft" }, data: { status: "published" } });
}

/** Usuarios ativos do tenant para o picker de pessoas do admin — inclui
 * `photoVisible` para o aviso de consentimento no momento da marcacao (LGPD). */
export function findUsersForPersonPicker(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.user.findMany({
    where: { tenantId, status: "active" },
    select: { id: true, fullName: true, registrationCode: true, branchId: true, photoVisible: true },
    orderBy: { fullName: "asc" },
  });
}

export type PostPersonInput = { userId: string; label?: string | null };

/**
 * Substitui as pessoas marcadas por completo (delete+insert, mesmo padrao de
 * replaceAnnouncementAudience). Valida que todo userId pertence ao tenant
 * ANTES de gravar — rejeita id de outro tenant ou inexistente (nao aceita
 * "nome livre"/id arbitrario, criterio de aceite do INC-008). A checagem
 * roda dentro do contexto de tenant (RLS), entao um id de outro tenant nunca
 * aparece no resultado de `findMany`, o que basta para detectar a tentativa.
 */
export async function replacePostPeople(
  tx: Prisma.TransactionClient,
  tenantId: string,
  postId: string,
  people: PostPersonInput[],
) {
  if (people.length > 0) {
    const userIds = people.map((p) => p.userId);
    const found = await tx.user.findMany({ where: { tenantId, id: { in: userIds } }, select: { id: true } });
    if (found.length !== new Set(userIds).size) {
      throw new Error("Uma ou mais pessoas marcadas não pertencem a este tenant ou não existem.");
    }
  }

  await tx.postPerson.deleteMany({ where: { postId, tenantId } });
  if (people.length === 0) return;
  await tx.postPerson.createMany({
    data: people.map((p) => ({ postId, tenantId, userId: p.userId, label: p.label ?? null })),
  });
}

/** `tx` ja' roda dentro da transacao aberta por withTenant — nao aninha
 * outra transacao aqui, so' duas queries sequenciais na mesma. */
export async function addPostMedia(tx: Prisma.TransactionClient, tenantId: string, postId: string, mediaUrl: string) {
  const last = await tx.postMedia.findFirst({ where: { postId, tenantId }, orderBy: { sortOrder: "desc" } });
  return tx.postMedia.create({
    data: { postId, tenantId, mediaUrl, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
}

export function removePostMedia(tx: Prisma.TransactionClient, tenantId: string, mediaId: string) {
  return tx.postMedia.deleteMany({ where: { id: mediaId, tenantId } });
}

export type FeedPage = {
  cursor?: { eventDate: Date; createdAt: Date; id: string };
  limit: number;
};

/** Feed do colaborador: so' publicados, cronologico por data do EVENTO
 * (desempate por created_at, depois id para paginacao estavel). Cursor-based
 * (nao offset) para nao pular/repetir posts quando um novo e' publicado
 * entre duas paginas. */
export function findPostsForFeed(tx: Prisma.TransactionClient, tenantId: string, page: FeedPage) {
  return tx.post.findMany({
    where: {
      tenantId,
      status: "published",
      ...(page.cursor
        ? {
            OR: [
              { eventDate: { lt: page.cursor.eventDate } },
              { eventDate: page.cursor.eventDate, createdAt: { lt: page.cursor.createdAt } },
              { eventDate: page.cursor.eventDate, createdAt: page.cursor.createdAt, id: { lt: page.cursor.id } },
            ],
          }
        : {}),
    },
    include: POST_DETAIL_INCLUDE,
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: page.limit,
  });
}

export type PostPersonView = { userId: string; fullName: string; label: string | null; photoUrl: string | null };

/** Ponto unico de aplicacao do consentimento de foto (LGPD): recalcula
 * sempre a partir do `photoVisible` atual do usuario, nunca de um valor
 * salvo no momento da marcacao — se o consentimento mudar depois do post
 * publicado, o card reflete o novo estado na proxima leitura. */
export function toPostPersonView(person: {
  userId: string;
  label: string | null;
  user: { fullName: string; photoUrl: string | null; photoVisible: boolean };
}): PostPersonView {
  return {
    userId: person.userId,
    fullName: person.user.fullName,
    label: person.label,
    photoUrl: person.user.photoVisible ? person.user.photoUrl : null,
  };
}
