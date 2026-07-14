import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { withTenant } from "../../src/lib/db/with-tenant";
import { birthdayWindowMonthDays } from "../../src/lib/dates/birthday-window";
import { findUpcomingBirthdays } from "../../src/lib/repositories/user.repository";
import { buildBirthdayListView } from "../../src/lib/birthdays/build-birthday-view";
import {
  addPostReaction,
  countPostReactions,
  createPostDraft,
  findPostReaction,
  publishPost,
  removePostReaction,
} from "../../src/lib/repositories/post.repository";

const ownerDb = new PrismaClient();

let tenantA: Awaited<ReturnType<typeof buildTenantFixtures>>;
let tenantB: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenantA = await buildTenantFixtures(ownerDb, {
    name: `Birthdays/Reactions Test A ${suffix}`,
    slug: `birthdays-reactions-test-a-${suffix}`,
    branchCount: 1,
    userCount: 5,
    cpfSeedOffset: 501,
    includeSampleAnnouncements: false,
  });
  tenantB = await buildTenantFixtures(ownerDb, {
    name: `Birthdays/Reactions Test B ${suffix}`,
    slug: `birthdays-reactions-test-b-${suffix}`,
    branchCount: 1,
    userCount: 5,
    cpfSeedOffset: 601,
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

describe("aniversariantes: opt-out (birthday_visible=false) nunca aparece", () => {
  it("pessoa com birthdayVisible=false não sai da query, mesmo com birth_date batendo na janela", async () => {
    const now = new Date("2026-07-14T12:00:00Z"); // meio-dia UTC, mesmo dia em SP
    const monthDays = birthdayWindowMonthDays(now, 0);

    const visible = tenantA.users[1];
    const hidden = tenantA.users[2];
    await ownerDb.user.update({
      where: { id: visible.id },
      data: { birthDate: new Date("1990-07-14"), birthdayVisible: true },
    });
    await ownerDb.user.update({
      where: { id: hidden.id },
      data: { birthDate: new Date("1990-07-14"), birthdayVisible: false },
    });

    const rows = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findUpcomingBirthdays(tx, tenantA.tenant.id, monthDays),
    );
    const ids = rows.map((r) => r.id);

    expect(ids).toContain(visible.id);
    expect(ids).not.toContain(hidden.id);
  });

  it("busca por nome (build-birthday-view) opera só sobre o array já filtrado — quem é oculto nunca chega nele", async () => {
    const now = new Date("2026-07-14T12:00:00Z");
    const monthDays = birthdayWindowMonthDays(now, 0);

    const hidden = tenantA.users[2]; // ja com birthdayVisible=false do teste anterior
    const rows = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findUpcomingBirthdays(tx, tenantA.tenant.id, monthDays),
    );
    const entries = await buildBirthdayListView(rows, monthDays);

    expect(entries.some((e) => e.userId === hidden.id)).toBe(false);
  });
});

describe("aniversariantes: virada de dia respeita America/Sao_Paulo, não UTC", () => {
  it("as 01:30 UTC, aniversariante do dia 13 (SP) aparece mesmo o relógio UTC já marcando dia 14", async () => {
    // 2026-07-14T01:30:00Z = 2026-07-13T22:30:00-03:00 em SP — "hoje" em SP
    // ainda é dia 13, embora o instante UTC já seja dia 14.
    const now = new Date("2026-07-14T01:30:00Z");
    const monthDays = birthdayWindowMonthDays(now, 0);
    expect(monthDays).toEqual([{ month: 7, day: 13 }]);

    const person = tenantA.users[3];
    await ownerDb.user.update({
      where: { id: person.id },
      data: { birthDate: new Date("1992-07-13"), birthdayVisible: true },
    });

    const rows = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findUpcomingBirthdays(tx, tenantA.tenant.id, monthDays),
    );
    expect(rows.map((r) => r.id)).toContain(person.id);

    // Se a virada de dia usasse UTC ingenuamente (dia 14), a janela seria
    // outra e esta pessoa (nascida dia 13) não apareceria.
    const naiveUtcMonthDays = [{ month: now.getUTCMonth() + 1, day: now.getUTCDate() }];
    expect(naiveUtcMonthDays).toEqual([{ month: 7, day: 14 }]);
  });
});

describe("aniversariantes: isolamento de tenant", () => {
  it("aniversariante do tenant B não aparece na query do tenant A", async () => {
    const now = new Date("2026-07-14T12:00:00Z");
    const monthDays = birthdayWindowMonthDays(now, 0);

    const personB = tenantB.users[1];
    await ownerDb.user.update({
      where: { id: personB.id },
      data: { birthDate: new Date("1990-07-14"), birthdayVisible: true },
    });

    const rowsA = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findUpcomingBirthdays(tx, tenantA.tenant.id, monthDays),
    );
    expect(rowsA.map((r) => r.id)).not.toContain(personB.id);
  });
});

describe("reações: idempotência (spam de toque não duplica)", () => {
  it("2 reações do mesmo usuário no mesmo post colidem na constraint (post_id,user_id) — nunca duplicam", async () => {
    const post = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      createPostDraft(tx, {
        tenantId: tenantA.tenant.id,
        type: "general",
        title: "Post para testar reação",
        eventDate: new Date("2026-07-01"),
        createdBy: tenantA.users[0].id,
      }),
    );
    await withTenant({ tenantId: tenantA.tenant.id }, (tx) => publishPost(tx, tenantA.tenant.id, post.id));

    const reactor = tenantA.users[1];

    await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      addPostReaction(tx, tenantA.tenant.id, post.id, reactor.id),
    );

    await expect(
      withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
        addPostReaction(tx, tenantA.tenant.id, post.id, reactor.id),
      ),
    ).rejects.toMatchObject({ code: "P2002" } satisfies Partial<Prisma.PrismaClientKnownRequestError>);

    const count = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      countPostReactions(tx, tenantA.tenant.id, post.id),
    );
    expect(count).toBe(1);
  });

  it("toggle: liga e depois desliga — reação some e contador volta a 0", async () => {
    const post = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      createPostDraft(tx, {
        tenantId: tenantA.tenant.id,
        type: "general",
        title: "Post para testar toggle de reação",
        eventDate: new Date("2026-07-01"),
        createdBy: tenantA.users[0].id,
      }),
    );
    await withTenant({ tenantId: tenantA.tenant.id }, (tx) => publishPost(tx, tenantA.tenant.id, post.id));

    const reactor = tenantA.users[1];

    await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      addPostReaction(tx, tenantA.tenant.id, post.id, reactor.id),
    );
    const afterOn = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findPostReaction(tx, tenantA.tenant.id, post.id, reactor.id),
    );
    expect(afterOn).not.toBeNull();

    await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      removePostReaction(tx, tenantA.tenant.id, post.id, reactor.id),
    );
    const afterOff = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      findPostReaction(tx, tenantA.tenant.id, post.id, reactor.id),
    );
    expect(afterOff).toBeNull();

    const count = await withTenant({ tenantId: tenantA.tenant.id }, (tx) =>
      countPostReactions(tx, tenantA.tenant.id, post.id),
    );
    expect(count).toBe(0);
  });
});
