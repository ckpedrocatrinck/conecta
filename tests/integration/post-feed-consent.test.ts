import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { withTenant } from "../../src/lib/db/with-tenant";
import {
  createPostDraft,
  findPostsForFeed,
  findPostWithDetails,
  publishPost,
  replacePostPeople,
  toPostPersonView,
} from "../../src/lib/repositories/post.repository";
import { buildFeedCards } from "../../src/lib/feed/build-feed-view";
import { buildPostCardData } from "../../src/lib/cards/card-model";

const ownerDb = new PrismaClient();

let tenantA: Awaited<ReturnType<typeof buildTenantFixtures>>;
let tenantB: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenantA = await buildTenantFixtures(ownerDb, {
    name: `Post Feed Test A ${suffix}`,
    slug: `post-feed-test-a-${suffix}`,
    branchCount: 1,
    userCount: 5,
    cpfSeedOffset: 301,
    includeSampleAnnouncements: false,
  });
  tenantB = await buildTenantFixtures(ownerDb, {
    name: `Post Feed Test B ${suffix}`,
    slug: `post-feed-test-b-${suffix}`,
    branchCount: 1,
    userCount: 5,
    cpfSeedOffset: 401,
    includeSampleAnnouncements: false,
  });
}, 60_000);

afterAll(async () => {
  const tenantIds = [tenantA.tenant.id, tenantB.tenant.id];
  await ownerDb.post.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await ownerDb.jobOpening.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await ownerDb.user.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await ownerDb.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await ownerDb.$disconnect();
});

describe("marcar pessoas puxa do cadastro real — nao aceita id livre/de outro tenant", () => {
  it("aceita userId que pertence ao tenant", async () => {
    const post = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      createPostDraft(tx, {
        tenantId: tenantA.tenant.id,
        type: "recognition",
        title: "Post valido",
        eventDate: new Date("2026-07-01"),
        createdBy: tenantA.users[0].id,
      }),
    );

    await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      replacePostPeople(tx, tenantA.tenant.id, post.id, [{ userId: tenantA.users[1].id }]),
    );

    const detail = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findPostWithDetails(tx, tenantA.tenant.id, post.id),
    );
    expect(detail?.people.map((p) => p.userId)).toEqual([tenantA.users[1].id]);
  });

  it("rejeita userId inexistente (nao aceita nome/id livre)", async () => {
    const post = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      createPostDraft(tx, {
        tenantId: tenantA.tenant.id,
        type: "general",
        title: "Post com id invalido",
        eventDate: new Date("2026-07-01"),
        createdBy: tenantA.users[0].id,
      }),
    );

    await expect(
      withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
        replacePostPeople(tx, tenantA.tenant.id, post.id, [{ userId: randomUUID() }]),
      ),
    ).rejects.toThrow();
  });

  it("rejeita userId que pertence a OUTRO tenant", async () => {
    const post = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      createPostDraft(tx, {
        tenantId: tenantA.tenant.id,
        type: "general",
        title: "Post tentando marcar pessoa de outro tenant",
        eventDate: new Date("2026-07-01"),
        createdBy: tenantA.users[0].id,
      }),
    );

    await expect(
      withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
        replacePostPeople(tx, tenantA.tenant.id, post.id, [{ userId: tenantB.users[0].id }]),
      ),
    ).rejects.toThrow();
  });
});

describe("consentimento de foto e' recalculado em tempo real (nunca snapshot)", () => {
  it("pessoa com photoVisible=false nunca mostra photoUrl, mesmo tendo User.photoUrl preenchido", async () => {
    const person = tenantA.users[2];
    await ownerDb.user.update({
      where: { id: person.id },
      data: { photoUrl: `avatars/${tenantA.tenant.id}/${person.id}`, photoVisible: false },
    });

    const post = await withTenant({ tenantId: tenantA.tenant.id }, async (tx) => {
      const created = await createPostDraft(tx, {
        tenantId: tenantA.tenant.id,
        type: "recognition",
        title: "Post com pessoa sem consentimento",
        eventDate: new Date("2026-07-02"),
        createdBy: tenantA.users[0].id,
      });
      await replacePostPeople(tx, tenantA.tenant.id, created.id, [{ userId: person.id }]);
      return created;
    });

    const detailBefore = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findPostWithDetails(tx, tenantA.tenant.id, post.id),
    );
    const viewBefore = toPostPersonView(detailBefore!.people[0]);
    expect(viewBefore.photoUrl).toBeNull();

    // Consentimento ligado DEPOIS de a pessoa ja estar marcada — a mesma
    // query, sem reprocessar o post, ja deve refletir a foto (prova que nao
    // e' um snapshot tirado no momento da marcacao).
    await ownerDb.user.update({ where: { id: person.id }, data: { photoVisible: true } });

    const detailAfter = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findPostWithDetails(tx, tenantA.tenant.id, post.id),
    );
    const viewAfter = toPostPersonView(detailAfter!.people[0]);
    expect(viewAfter.photoUrl).toBe(`avatars/${tenantA.tenant.id}/${person.id}`);
  });
});

describe("card gerado (INC-009): nunca exibe foto de quem não consente", () => {
  it("pessoa com photoVisible=false chega ao CardData do template com photoUrl null, mesmo com User.photoUrl preenchido", async () => {
    const person = tenantA.users[3];
    await ownerDb.user.update({
      where: { id: person.id },
      data: { photoUrl: `avatars/${tenantA.tenant.id}/${person.id}`, photoVisible: false },
    });

    const post = await withTenant({ tenantId: tenantA.tenant.id }, async (tx) => {
      const created = await createPostDraft(tx, {
        tenantId: tenantA.tenant.id,
        type: "recognition",
        title: "Reconhecimento sem consentimento de foto",
        eventDate: new Date("2026-07-05"),
        createdBy: tenantA.users[0].id,
      });
      await replacePostPeople(tx, tenantA.tenant.id, created.id, [{ userId: person.id }]);
      return created;
    });

    const detail = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findPostWithDetails(tx, tenantA.tenant.id, post.id),
    );
    const [feedCard] = await buildFeedCards([detail!], tenantA.users[0].id);
    const cardData = buildPostCardData(feedCard, { logoUrl: null, accentColor: null });

    expect(cardData?.people[0].photoUrl).toBeNull();
  });
});

describe("feed: isolamento de tenant e ordenacao cronologica", () => {
  it("so' mostra publicados do proprio tenant, mais recentes (data do evento) primeiro", async () => {
    const makePost = (tenantId: string, createdBy: string, eventDate: string, status: "draft" | "published") =>
      withTenant({ tenantId }, async (tx) => {
        const post = await createPostDraft(tx, {
          tenantId,
          type: "general",
          title: `Post ${eventDate} (${status})`,
          eventDate: new Date(eventDate),
          createdBy,
        });
        if (status === "published") await publishPost(tx, tenantId, post.id);
        return post;
      });

    // buildTenantFixtures ja semeia 3 posts publicados (eventDate = hoje) por
    // tenant — por isso a asserção compara so' a ordem RELATIVA dos 3 posts
    // deste teste entre si, em vez de esperar a lista inteira.
    const oldest = await makePost(tenantA.tenant.id, tenantA.users[0].id, "2026-06-01", "published");
    const middle = await makePost(tenantA.tenant.id, tenantA.users[0].id, "2026-06-15", "published");
    const newest = await makePost(tenantA.tenant.id, tenantA.users[0].id, "2026-06-30", "published");
    const draft = await makePost(tenantA.tenant.id, tenantA.users[0].id, "2026-07-10", "draft");
    const otherTenantPost = await makePost(tenantB.tenant.id, tenantB.users[0].id, "2026-06-30", "published");

    const feed = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findPostsForFeed(tx, tenantA.tenant.id, { limit: 100 }),
    );
    const feedIds = feed.map((p) => p.id);

    const relativeOrder = feedIds.filter((id) => [oldest.id, middle.id, newest.id].includes(id));
    expect(relativeOrder).toEqual([newest.id, middle.id, oldest.id]);
    expect(feedIds).not.toContain(draft.id);
    expect(feedIds).not.toContain(otherTenantPost.id);
    expect(feed.every((p) => p.tenantId === tenantA.tenant.id)).toBe(true);
    expect(feed.every((p) => p.status === "published")).toBe(true);
  });

  it("pagina com cursor sem pular nem repetir posts", async () => {
    const firstPage = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findPostsForFeed(tx, tenantA.tenant.id, { limit: 2 }),
    );
    expect(firstPage).toHaveLength(2);

    const last = firstPage[1];
    const secondPage = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findPostsForFeed(tx, tenantA.tenant.id, {
        limit: 2,
        cursor: { eventDate: last.eventDate, createdAt: last.createdAt, id: last.id },
      }),
    );

    const firstIds = new Set(firstPage.map((p) => p.id));
    expect(secondPage.some((p) => firstIds.has(p.id))).toBe(false);
  });
});
