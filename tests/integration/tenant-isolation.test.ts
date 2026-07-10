import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureAppRolePassword } from "../../prisma/db-admin";
import { buildTenantFixtures } from "../../prisma/seed-data";
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
  await ensureAppRolePassword(ownerDb);

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
  const tenantIds = [tenantA.tenant.id, tenantB.tenant.id];
  // announcement_acks e' imutavel por trigger mesmo para a role owner —
  // inclusive contra DELETE em cascata (por desenho, ver migration
  // rls_and_triggers). Para limpar dados de TESTE, desabilitamos so' os
  // triggers de usuario (nao os de FK/sistema) durante a limpeza.
  await ownerDb.$executeRawUnsafe("ALTER TABLE announcement_acks DISABLE TRIGGER USER");
  try {
    // Ordem explicita: announcement/post/jobOpening carregam um createdBy
    // (onDelete: Restrict) apontando para User — precisam sair ANTES do
    // usuario, senao o cascade de Tenant->User colide com esse Restrict.
    await ownerDb.announcement.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await ownerDb.post.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await ownerDb.jobOpening.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await ownerDb.user.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await ownerDb.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  } finally {
    await ownerDb.$executeRawUnsafe("ALTER TABLE announcement_acks ENABLE TRIGGER USER");
  }
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
});

describe("adversarial — acesso direto por ID que pertence ao outro tenant", () => {
  it("tenant A nao encontra, por ID, um comunicado que pertence ao tenant B", async () => {
    const targetId = tenantB.announcements[0].announcement.id;
    const result = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findAnnouncementById(tx, tenantA.tenant.id, targetId),
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
    const before = await ownerDb.announcementAck.count();

    const attempt = ownerDb.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("TRUNCATE announcement_acks");
      // Nunca deveria chegar aqui — o trigger deveria disparar antes. Se
      // disparar por engano, este erro sentinela ainda garante ROLLBACK
      // (TRUNCATE e transacional no Postgres) sem perder dados reais.
      throw new Error("__force_rollback_sentinel__");
    });

    await expect(attempt).rejects.toThrow(/imutavel/i);

    const after = await ownerDb.announcementAck.count();
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
