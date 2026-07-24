import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { cleanupTenant } from "../helpers/cleanup-tenant";
import { withTenant } from "../../src/lib/db/with-tenant";
import { addPostMedia, countPostMedia, findPostMediaById } from "../../src/lib/repositories/post.repository";

// INC-016 — contrato de DB em que o confirm de upload e a rota /api/anexo se
// apoiam: persistencia dos metadados do anexo, contagem por tenant (teto por
// post) e ISOLAMENTO cross-tenant do acesso por id (a rota so' encontra o anexo
// via findPostMediaById sob withTenant; anexo de outro tenant -> null -> 404).
const ownerDb = new PrismaClient();

let tenantA: Awaited<ReturnType<typeof buildTenantFixtures>>;
let tenantB: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenantA = await buildTenantFixtures(ownerDb, {
    name: `Attach A ${suffix}`,
    slug: `attach-a-${suffix}`,
    branchCount: 1,
    userCount: 6,
    cpfSeedOffset: 301,
  });
  tenantB = await buildTenantFixtures(ownerDb, {
    name: `Attach B ${suffix}`,
    slug: `attach-b-${suffix}`,
    branchCount: 1,
    userCount: 6,
    cpfSeedOffset: 402,
  });
}, 60_000);

afterAll(async () => {
  await cleanupTenant(ownerDb, tenantA.tenant.id);
  await cleanupTenant(ownerDb, tenantB.tenant.id);
  await ownerDb.$disconnect();
});

describe("anexo de post — persistencia e contagem [INC-016]", () => {
  it("addPostMedia grava kind/mime/nome/tamanho (documento PDF)", async () => {
    const postId = tenantA.posts[0].id;
    const created = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      addPostMedia(tx, tenantA.tenant.id, postId, {
        mediaUrl: `posts/${tenantA.tenant.id}/${postId}/${randomUUID()}`,
        kind: "document",
        mimeType: "application/pdf",
        originalName: "contrato.pdf",
        sizeBytes: 123456,
      }),
    );
    expect(created.kind).toBe("document");
    expect(created.mimeType).toBe("application/pdf");
    expect(created.originalName).toBe("contrato.pdf");
    expect(created.sizeBytes).toBe(123456);
  });

  it("countPostMedia conta os anexos do post sob o tenant", async () => {
    const postId = tenantA.posts[0].id;
    const before = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      countPostMedia(tx, tenantA.tenant.id, postId),
    );
    await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      addPostMedia(tx, tenantA.tenant.id, postId, {
        mediaUrl: `posts/${tenantA.tenant.id}/${postId}/${randomUUID()}`,
        kind: "image",
        mimeType: "image/png",
        originalName: "foto.png",
        sizeBytes: 2048,
      }),
    );
    const after = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      countPostMedia(tx, tenantA.tenant.id, postId),
    );
    expect(after).toBe(before + 1);
  });
});

describe("anexo de post — isolamento cross-tenant (base do /api/anexo) [INC-016]", () => {
  it("tenant B nao encontra, por id, um anexo do tenant A -> null (route daria 404)", async () => {
    const postIdA = tenantA.posts[0].id;
    const mediaA = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      addPostMedia(tx, tenantA.tenant.id, postIdA, {
        mediaUrl: `posts/${tenantA.tenant.id}/${postIdA}/${randomUUID()}`,
        kind: "document",
        mimeType: "application/pdf",
        originalName: "sigiloso.pdf",
        sizeBytes: 1000,
      }),
    );

    const fromB = await withTenant({ tenantId: tenantB.tenant.id }, (tx) =>
      findPostMediaById(tx, tenantB.tenant.id, mediaA.id),
    );
    expect(fromB).toBeNull();

    // e o proprio tenant A encontra normalmente
    const fromA = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findPostMediaById(tx, tenantA.tenant.id, mediaA.id),
    );
    expect(fromA?.id).toBe(mediaA.id);
  });

  it("tenant A nao grava anexo com tenant_id de B estando no contexto de A (RLS WITH CHECK)", async () => {
    const postIdB = tenantB.posts[0].id;
    await expect(
      withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
        tx.postMedia.create({
          data: {
            postId: postIdB,
            tenantId: tenantB.tenant.id,
            mediaUrl: `posts/${tenantB.tenant.id}/${postIdB}/${randomUUID()}`,
            kind: "image",
          },
        }),
      ),
    ).rejects.toThrow();
  });
});
