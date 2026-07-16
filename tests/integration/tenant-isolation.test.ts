import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { cleanupTenant } from "../helpers/cleanup-tenant";
import { withTenant } from "../../src/lib/db/with-tenant";
import { createAnnouncementAck, findAnnouncementAcksByTenant } from "../../src/lib/repositories/announcement-ack.repository";
import { findAnnouncementById, findAnnouncementsByTenant } from "../../src/lib/repositories/announcement.repository";
import { findJobOpeningsByTenant } from "../../src/lib/repositories/job-opening.repository";
import { findPostsByTenant } from "../../src/lib/repositories/post.repository";
import { findUsersByTenant } from "../../src/lib/repositories/user.repository";

// Role owner (DATABASE_URL) — bypassa RLS de proposito, so' para montar as
// fixtures dos dois tenants e para os testes que precisam confirmar que o
// TRIGGER de imutabilidade funciona independente de GRANT.
const ownerDb = new PrismaClient();

let tenantA: Awaited<ReturnType<typeof buildTenantFixtures>>;
let tenantB: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  // Senha da role conecta_app e' garantida uma unica vez pelo globalSetup do
  // vitest (tests/global-setup.ts) — chamar de novo aqui, em paralelo com
  // outros arquivos de teste, causava "tuple concurrently updated" no
  // Postgres (dois ALTER ROLE concorrentes na mesma role).
  const suffix = randomUUID().slice(0, 8);
  tenantA = await buildTenantFixtures(ownerDb, {
    name: `Isolation Test A ${suffix}`,
    slug: `isolation-test-a-${suffix}`,
    branchCount: 1,
    userCount: 6,
    cpfSeedOffset: 101,
  });
  tenantB = await buildTenantFixtures(ownerDb, {
    name: `Isolation Test B ${suffix}`,
    slug: `isolation-test-b-${suffix}`,
    branchCount: 1,
    userCount: 6,
    cpfSeedOffset: 202,
  });
}, 60_000);

afterAll(async () => {
  // cleanupTenant roda sob SET LOCAL session_replication_role='replica'
  // (A7-1) — desativa tambem os triggers de FK/cascade, entao a ordem entre
  // tabelas deixa de importar (nada e' verificado dentro da transacao); por
  // isso nao ha' mais necessidade da ordem explicita que existia aqui antes
  // (announcement/post/jobOpening antes de user, por causa do
  // onDelete: Restrict em createdBy).
  await cleanupTenant(ownerDb, tenantA.tenant.id);
  await cleanupTenant(ownerDb, tenantB.tenant.id);
  await ownerDb.$disconnect();
});

describe("caminho feliz — via camada de acesso (withTenant + repositorio)", () => {
  it("tenant A so ve seus proprios usuarios", async () => {
    const users = await withTenant({ tenantId: tenantA.tenant.id }, (tx) => findUsersByTenant(tx, tenantA.tenant.id));
    expect(users.length).toBe(tenantA.users.length);
    expect(users.every((u) => u.tenantId === tenantA.tenant.id)).toBe(true);
  });

  it("tenant A so ve seus proprios comunicados", async () => {
    const announcements = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findAnnouncementsByTenant(tx, tenantA.tenant.id),
    );
    expect(announcements.length).toBe(tenantA.announcements.length);
    expect(announcements.every((a) => a.tenantId === tenantA.tenant.id)).toBe(true);
  });

  it("tenant A so ve seus proprios acks", async () => {
    const acks = await withTenant({ tenantId: tenantA.tenant.id }, (tx) => findAnnouncementAcksByTenant(tx, tenantA.tenant.id));
    expect(acks.length).toBeGreaterThan(0);
    expect(acks.every((a) => a.tenantId === tenantA.tenant.id)).toBe(true);
  });

  it("tenant A so ve seus proprios posts", async () => {
    const posts = await withTenant({ tenantId: tenantA.tenant.id }, (tx) => findPostsByTenant(tx, tenantA.tenant.id));
    expect(posts.length).toBe(tenantA.posts.length);
    expect(posts.every((p) => p.tenantId === tenantA.tenant.id)).toBe(true);
  });

  it("tenant A so ve suas proprias vagas", async () => {
    const jobs = await withTenant({ tenantId: tenantA.tenant.id }, (tx) => findJobOpeningsByTenant(tx, tenantA.tenant.id));
    expect(jobs.length).toBe(tenantA.jobOpenings.length);
    expect(jobs.every((j) => j.tenantId === tenantA.tenant.id)).toBe(true);
  });
});

describe("adversarial — query SEM filtro dentro do contexto de tenant A (prova a RLS, nao so o filtro da app) [INC-008]", () => {
  it("postPerson.findMany() sem where ainda retorna so tenant A", async () => {
    const rows = await withTenant({ tenantId: tenantA.tenant.id }, (tx) => tx.postPerson.findMany());
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.tenantId === tenantA.tenant.id)).toBe(true);
  });

  it("postMedia.findMany() sem where ainda retorna so tenant A", async () => {
    const rows = await withTenant({ tenantId: tenantA.tenant.id }, (tx) => tx.postMedia.findMany());
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.tenantId === tenantA.tenant.id)).toBe(true);
  });

  it("postReaction.findMany() sem where ainda retorna so tenant A", async () => {
    const rows = await withTenant({ tenantId: tenantA.tenant.id }, (tx) => tx.postReaction.findMany());
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.tenantId === tenantA.tenant.id)).toBe(true);
  });

  it("tenant A nao consegue gravar postPerson com tenant_id de B estando no contexto de A (WITH CHECK)", async () => {
    await expect(
      withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
        tx.postPerson.create({
          data: {
            postId: tenantB.posts[0].id,
            userId: tenantB.users[1].id,
            tenantId: tenantB.tenant.id,
          },
        }),
      ),
    ).rejects.toThrow();
  });
});

describe("adversarial — query SEM filtro dentro do contexto de tenant A (prova a RLS, nao so o filtro da app)", () => {
  it("users.findMany() sem where ainda retorna so tenant A", async () => {
    const users = await withTenant({ tenantId: tenantA.tenant.id }, (tx) => tx.user.findMany());
    expect(users.length).toBeGreaterThan(0);
    expect(users.every((u) => u.tenantId === tenantA.tenant.id)).toBe(true);
  });

  it("announcement.findMany() sem where ainda retorna so tenant A", async () => {
    const announcements = await withTenant({ tenantId: tenantA.tenant.id }, (tx) => tx.announcement.findMany());
    expect(announcements.length).toBeGreaterThan(0);
    expect(announcements.every((a) => a.tenantId === tenantA.tenant.id)).toBe(true);
  });

  it("announcementAck.findMany() sem where ainda retorna so tenant A", async () => {
    const acks = await withTenant({ tenantId: tenantA.tenant.id }, (tx) => tx.announcementAck.findMany());
    expect(acks.length).toBeGreaterThan(0);
    expect(acks.every((a) => a.tenantId === tenantA.tenant.id)).toBe(true);
  });

  it("post.findMany() sem where ainda retorna so tenant A", async () => {
    const posts = await withTenant({ tenantId: tenantA.tenant.id }, (tx) => tx.post.findMany());
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every((p) => p.tenantId === tenantA.tenant.id)).toBe(true);
  });

  it("jobOpening.findMany() sem where ainda retorna so tenant A", async () => {
    const jobs = await withTenant({ tenantId: tenantA.tenant.id }, (tx) => tx.jobOpening.findMany());
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.every((j) => j.tenantId === tenantA.tenant.id)).toBe(true);
  });

  it("jobApplication.findMany() sem where ainda retorna so tenant A [INC-011]", async () => {
    const applications = await withTenant({ tenantId: tenantA.tenant.id }, (tx) => tx.jobApplication.findMany());
    expect(applications.length).toBeGreaterThan(0);
    expect(applications.every((a) => a.tenantId === tenantA.tenant.id)).toBe(true);
  });
});

describe("adversarial — acesso direto por ID que pertence ao outro tenant", () => {
  it("tenant A nao encontra, por ID, um comunicado que pertence ao tenant B", async () => {
    const targetId = tenantB.announcements[0].announcement.id;
    const result = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findAnnouncementById(tx, tenantA.tenant.id, targetId),
    );
    expect(result).toBeNull();
  });

  it("tenant A nao encontra, por ID, um post_media que pertence ao tenant B [INC-008]", async () => {
    const targetMedia = await ownerDb.postMedia.findFirstOrThrow({ where: { postId: tenantB.posts[0].id } });
    const result = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      tx.postMedia.findFirst({ where: { id: targetMedia.id } }),
    );
    expect(result).toBeNull();
  });

  it("tenant A nao encontra, por ID, um usuario que pertence ao tenant B (query raw do Prisma, sem where de tenant)", async () => {
    const targetId = tenantB.users[0].id;
    const result = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      tx.user.findUnique({ where: { id: targetId } }),
    );
    expect(result).toBeNull();
  });

  it("tenant A nao consegue criar um ack referenciando um comunicado do tenant B (WITH CHECK)", async () => {
    const targetAnnouncement = tenantB.announcements[0];
    await expect(
      withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
        createAnnouncementAck(tx, {
          tenantId: tenantB.tenant.id, // tenta gravar com tenant_id de B estando no contexto de A
          announcementId: targetAnnouncement.announcement.id,
          versionId: targetAnnouncement.version.id,
          userId: tenantA.users[0].id,
          contentHashAtAck: targetAnnouncement.version.contentHash,
        }),
      ),
    ).rejects.toThrow();
  });
});

describe("AnnouncementAck e' imutavel — garantia estrutural (nao so' convencao)", () => {
  it("conecta_app nao tem privilegio de UPDATE/DELETE (grant minimo)", async () => {
    const [ack] = await ownerDb.announcementAck.findMany({ where: { tenantId: tenantA.tenant.id }, take: 1 });
    expect(ack).toBeTruthy();

    await expect(
      withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
        tx.announcementAck.update({ where: { id: ack.id }, data: { contentHashAtAck: "hack" } }),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant({ tenantId: tenantA.tenant.id }, (tx) => tx.announcementAck.delete({ where: { id: ack.id } })),
    ).rejects.toThrow();
  });

  it("o trigger recusa UPDATE/DELETE mesmo para a role owner, independente de GRANT", async () => {
    const [ack] = await ownerDb.announcementAck.findMany({ where: { tenantId: tenantA.tenant.id }, take: 1 });

    await expect(
      ownerDb.announcementAck.update({ where: { id: ack.id }, data: { contentHashAtAck: "hack" } }),
    ).rejects.toThrow(/imutavel/i);

    await expect(ownerDb.announcementAck.delete({ where: { id: ack.id } })).rejects.toThrow(/imutavel/i);
  });

  it("o trigger recusa TRUNCATE mesmo para a role owner, sem perda de dados (rollback forcado)", async () => {
    // Contagem escopada ao tenant A (nao count() global, INC-012.5/A7-1) —
    // a suite roda arquivos em paralelo e outros tenants gravam acks
    // concorrentemente; um count() sem where oscilava por causa dessa
    // atividade legitima de OUTROS testes, sem relacao com o trigger
    // (flakiness observada e corrigida durante o INC-012.5).
    const before = await ownerDb.announcementAck.count({ where: { tenantId: tenantA.tenant.id } });

    const attempt = ownerDb.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("TRUNCATE announcement_acks");
      // Nunca deveria chegar aqui — o trigger deveria disparar antes. Se
      // disparar por engano, este erro sentinela ainda garante ROLLBACK
      // (TRUNCATE e transacional no Postgres) sem perder dados reais.
      throw new Error("__force_rollback_sentinel__");
    });

    await expect(attempt).rejects.toThrow(/imutavel/i);

    const after = await ownerDb.announcementAck.count({ where: { tenantId: tenantA.tenant.id } });
    expect(after).toBe(before);
  });
});

describe("guarda de regressao — toda tabela de dominio tem RLS habilitada e forcada", () => {
  it("nenhuma tabela de dominio ficou sem rowsecurity (fora tenants e _prisma_migrations)", async () => {
    const rows = await ownerDb.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND rowsecurity = false
        AND tablename NOT IN ('tenants', '_prisma_migrations')
    `;
    expect(rows).toEqual([]);
  });
});
