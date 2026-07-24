import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { cleanupTenant } from "../helpers/cleanup-tenant";
import { withTenant } from "../../src/lib/db/with-tenant";
import {
  addPostMedia,
  createPostDraft,
  deletePostsByIds,
  findPostsForAdminList,
  findPristineDraftsByAdmin,
} from "../../src/lib/repositories/post.repository";

// INC-016 — auto-rascunho. Tratamento de orfaos no nivel de repositorio (a
// server action createOrReuseDraftAction e' orquestracao fina sobre estes):
// pristine = draft sem titulo/texto/pessoas/midia; reusa 1 e apaga extras;
// nunca listado. Prova a garantia de "<=1 scaffold por admin, sem sweep".
const ownerDb = new PrismaClient();
let t: Awaited<ReturnType<typeof buildTenantFixtures>>;
let adminId: string;

async function newPristineDraft(createdBy: string): Promise<string> {
  const post = await withTenant({ tenantId: t.tenant.id }, (tx) =>
    createPostDraft(tx, {
      tenantId: t.tenant.id,
      type: "recognition",
      title: "",
      body: null,
      eventDate: new Date(),
      branchId: null,
      createdBy,
    }),
  );
  return post.id;
}

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  t = await buildTenantFixtures(ownerDb, {
    name: `AutoDraft ${suffix}`,
    slug: `auto-draft-${suffix}`,
    branchCount: 1,
    userCount: 6,
    cpfSeedOffset: 503,
  });
  adminId = t.users[0].id;
}, 60_000);

afterAll(async () => {
  await cleanupTenant(ownerDb, t.tenant.id);
  await ownerDb.$disconnect();
});

describe("findPristineDraftsByAdmin [INC-016]", () => {
  it("encontra rascunho pristine, mas ignora os que tem conteudo", async () => {
    const pristineId = await newPristineDraft(adminId);

    // rascunho com titulo -> nao e' pristine
    await withTenant({ tenantId: t.tenant.id }, (tx) =>
      createPostDraft(tx, {
        tenantId: t.tenant.id,
        type: "recognition",
        title: "Tem titulo",
        body: null,
        eventDate: new Date(),
        branchId: null,
        createdBy: adminId,
      }),
    );

    const pristine = await withTenant({ tenantId: t.tenant.id }, (tx) =>
      findPristineDraftsByAdmin(tx, t.tenant.id, adminId),
    );
    const ids = pristine.map((p) => p.id);
    expect(ids).toContain(pristineId);
    expect(pristine.length).toBe(1);
  });

  it("rascunho com anexo deixa de ser pristine", async () => {
    const draftId = await newPristineDraft(adminId);
    await withTenant({ tenantId: t.tenant.id }, (tx) =>
      addPostMedia(tx, t.tenant.id, draftId, {
        mediaUrl: `posts/${t.tenant.id}/${draftId}/${randomUUID()}`,
        kind: "image",
        mimeType: "image/png",
        originalName: "f.png",
        sizeBytes: 10,
      }),
    );
    const pristine = await withTenant({ tenantId: t.tenant.id }, (tx) =>
      findPristineDraftsByAdmin(tx, t.tenant.id, adminId),
    );
    expect(pristine.map((p) => p.id)).not.toContain(draftId);
  });
});

describe("reaproveitamento + limpeza mantem <=1 pristine por admin [INC-016]", () => {
  it("com 3 pristine, reusa o mais recente e apaga os extras", async () => {
    // Limpa o estado anterior deste admin para isolar a contagem.
    const existing = await withTenant({ tenantId: t.tenant.id }, (tx) =>
      findPristineDraftsByAdmin(tx, t.tenant.id, adminId),
    );
    await withTenant({ tenantId: t.tenant.id }, (tx) =>
      deletePostsByIds(tx, t.tenant.id, existing.map((p) => p.id)),
    );

    await newPristineDraft(adminId);
    await newPristineDraft(adminId);
    await newPristineDraft(adminId);

    // Mesma logica da action: mantem o 1o, apaga o resto.
    const kept = await withTenant({ tenantId: t.tenant.id }, async (tx) => {
      const pristine = await findPristineDraftsByAdmin(tx, t.tenant.id, adminId);
      const [keep, ...extras] = pristine;
      await deletePostsByIds(tx, t.tenant.id, extras.map((p) => p.id));
      return keep.id;
    });

    const after = await withTenant({ tenantId: t.tenant.id }, (tx) =>
      findPristineDraftsByAdmin(tx, t.tenant.id, adminId),
    );
    expect(after.length).toBe(1);
    expect(after[0].id).toBe(kept);
  });
});

describe("findPostsForAdminList exclui pristine, mantem conteudo [INC-016]", () => {
  it("nao lista pristine; lista rascunho com conteudo e posts publicados", async () => {
    const pristineId = await newPristineDraft(adminId);

    const withContent = await withTenant({ tenantId: t.tenant.id }, (tx) =>
      createPostDraft(tx, {
        tenantId: t.tenant.id,
        type: "general",
        title: "Rascunho com titulo",
        body: null,
        eventDate: new Date(),
        branchId: null,
        createdBy: adminId,
      }),
    );
    const withContentId = withContent.id;

    const list = await withTenant({ tenantId: t.tenant.id }, (tx) => findPostsForAdminList(tx, t.tenant.id));
    const listIds = list.map((p) => p.id);

    expect(listIds).not.toContain(pristineId);
    expect(listIds).toContain(withContentId);
    // os posts publicados das fixtures continuam na lista
    expect(listIds).toContain(t.posts[0].id);
  });
});
