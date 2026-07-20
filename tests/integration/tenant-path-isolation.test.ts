import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { cleanupTenant } from "../helpers/cleanup-tenant";
import { withTenant } from "../../src/lib/db/with-tenant";
import { createSession, findValidSession } from "../../src/lib/repositories/session.repository";
import { findUsersByTenant } from "../../src/lib/repositories/user.repository";
import { resolveTenantBySlug } from "../../src/lib/tenant/resolve-tenant";
import { sessionMatchesTenant } from "../../src/lib/tenant/tenant-access";

// INC-014 Bloco 3 — o coracao do INC: a sessao do tenant A NUNCA acessa dados
// do tenant B. Prova em duas camadas: (1) a decisao pura de aceitacao da sessao
// (sessionMatchesTenant); (2) o backstop RLS — a sessao de A nao existe sob o
// contexto de B, e o tenant da URL governa o contexto de dados. Role owner so'
// para montar/derrubar fixtures; a resolucao/consulta roda pelo appDb como em
// producao. NAO toca withTenant nem policies (principio-mestre do INC).
const ownerDb = new PrismaClient();

let tenantA: Awaited<ReturnType<typeof buildTenantFixtures>>;
let tenantB: Awaited<ReturnType<typeof buildTenantFixtures>>;
let sessionAId: string;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenantA = await buildTenantFixtures(ownerDb, {
    name: `Path Iso A ${suffix}`,
    slug: `path-iso-a-${suffix}`,
    branchCount: 1,
    userCount: 6,
    cpfSeedOffset: 401,
  });
  tenantB = await buildTenantFixtures(ownerDb, {
    name: `Path Iso B ${suffix}`,
    slug: `path-iso-b-${suffix}`,
    branchCount: 1,
    userCount: 6,
    cpfSeedOffset: 402,
  });
  // Sessao REAL do tenant A (via camada de acesso, como o login faz).
  const session = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
    createSession(tx, {
      tenantId: tenantA.tenant.id,
      userId: tenantA.users[0].id,
      expiresAt: new Date(Date.now() + 3_600_000),
    }),
  );
  sessionAId = session.id;
}, 60_000);

afterAll(async () => {
  await cleanupTenant(ownerDb, tenantA.tenant.id);
  await cleanupTenant(ownerDb, tenantB.tenant.id);
  await ownerDb.$disconnect();
});

describe("decisao pura de aceitacao da sessao (o caso cross-tenant)", () => {
  it("aceita a sessao de A na URL de A", () => {
    expect(sessionMatchesTenant({ tenantId: tenantA.tenant.id }, tenantA.tenant.id)).toBe(true);
  });

  it("REJEITA a sessao de A na URL de B -> guard manda ao login de B (nunca dados de B)", () => {
    expect(sessionMatchesTenant({ tenantId: tenantA.tenant.id }, tenantB.tenant.id)).toBe(false);
  });

  it("REJEITA quando nao ha sessao (JWT ausente/adulterado que o Auth.js ja recusou)", () => {
    expect(sessionMatchesTenant(null, tenantB.tenant.id)).toBe(false);
  });
});

describe("backstop RLS — a sessao de A nao existe no contexto de B", () => {
  it("findValidSession da sessao de A retorna null sob o contexto do tenant B", async () => {
    const underB = await withTenant({ tenantId: tenantB.tenant.id }, (tx) => findValidSession(tx, sessionAId));
    expect(underB).toBeNull();
  });

  it("a MESMA sessao e' valida sob o contexto do proprio tenant A (sanidade)", async () => {
    const underA = await withTenant({ tenantId: tenantA.tenant.id }, (tx) => findValidSession(tx, sessionAId));
    expect(underA?.id).toBe(sessionAId);
  });
});

describe("o tenant da URL governa o contexto de dados (set_config), nao um valor do cliente", () => {
  it("resolvido o slug de B, o contexto so' enxerga usuarios de B", async () => {
    const urlTenant = await resolveTenantBySlug(tenantB.tenant.slug);
    expect(urlTenant?.id).toBe(tenantB.tenant.id);

    const users = await withTenant({ tenantId: urlTenant!.id }, (tx) => findUsersByTenant(tx, urlTenant!.id));
    expect(users.length).toBeGreaterThan(0);
    expect(users.every((u) => u.tenantId === tenantB.tenant.id)).toBe(true);
    expect(users.some((u) => u.tenantId === tenantA.tenant.id)).toBe(false);
  });

  it("slug inexistente resolve null (o boundary [slug] converte em 404 sem vazar)", async () => {
    const resolved = await resolveTenantBySlug(`nao-existe-${randomUUID().slice(0, 8)}`);
    expect(resolved).toBeNull();
  });
});
