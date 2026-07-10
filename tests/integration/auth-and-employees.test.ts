import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { hashCpf } from "../../src/lib/crypto/cpf-hash";
import { verifyPassword } from "../../src/lib/crypto/password-hash";
import { withTenant } from "../../src/lib/db/with-tenant";
import { deleteBranch, findBranchesByTenant, countUsersInBranch } from "../../src/lib/repositories/branch.repository";
import { applyEmployeeCsvRow } from "../../src/lib/csv/employee-import";
import {
  createSession,
  findValidSession,
  revokeOtherUserSessions,
  revokeSession,
} from "../../src/lib/repositories/session.repository";
import {
  findUserByCpfHash,
  findUserById,
  registerFailedLogin,
  registerSuccessfulLogin,
  updateConsentToggles,
  updateEmployeeProfile,
} from "../../src/lib/repositories/user.repository";

const ownerDb = new PrismaClient();

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;
const CPF_OFFSET = 900;

beforeAll(async () => {
  // Senha da role conecta_app e' garantida uma unica vez pelo globalSetup do
  // vitest (tests/global-setup.ts) — ver comentario equivalente em
  // tenant-isolation.test.ts.
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Auth Test ${suffix}`,
    slug: `auth-test-${suffix}`,
    branchCount: 1,
    // buildTenantFixtures referencia users[0..3] internamente (posts/vagas
    // de exemplo) — precisa de pelo menos 4, mesmo os testes aqui so
    // usando os 3 primeiros.
    userCount: 4,
    cpfSeedOffset: CPF_OFFSET,
  });
}, 60_000);

afterAll(async () => {
  await ownerDb.$executeRawUnsafe("ALTER TABLE announcement_acks DISABLE TRIGGER USER");
  try {
    await ownerDb.announcement.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.post.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.jobOpening.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.user.deleteMany({ where: { tenantId: tenant.tenant.id } });
    await ownerDb.tenant.deleteMany({ where: { id: tenant.tenant.id } });
  } finally {
    await ownerDb.$executeRawUnsafe("ALTER TABLE announcement_acks ENABLE TRIGGER USER");
  }
  await ownerDb.$disconnect();
});

function cpfFor(index: number): string {
  return String(10_000_000_000 + CPF_OFFSET * 1000 + index).padStart(11, "0");
}

describe("login por CPF (dentro do tenant resolvido)", () => {
  it("localiza o usuario por cpf_hash e a senha padrao do seed confere", async () => {
    const found = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findUserByCpfHash(tx, tenant.tenant.id, hashCpf(cpfFor(0))),
    );
    expect(found?.id).toBe(tenant.users[0].id);
    await expect(verifyPassword("Trocar123!", found!.passwordHash)).resolves.toBe(true);
  });

  it("senha errada nao confere", async () => {
    const found = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findUserByCpfHash(tx, tenant.tenant.id, hashCpf(cpfFor(0))),
    );
    await expect(verifyPassword("senha-errada", found!.passwordHash)).resolves.toBe(false);
  });

  it("cpf inexistente no tenant nao encontra ninguem", async () => {
    const found = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findUserByCpfHash(tx, tenant.tenant.id, hashCpf("00000000000")),
    );
    expect(found).toBeNull();
  });
});

describe("rate limit de login (sem Redis)", () => {
  it("tranca a conta apos 5 tentativas falhas", async () => {
    const userId = tenant.users[1].id;

    await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
      let attempts = 0;
      for (let i = 0; i < 5; i++) {
        await registerFailedLogin(tx, userId, attempts);
        attempts++;
      }
      const user = await findUserById(tx, tenant.tenant.id, userId);
      expect(user?.failedLoginAttempts).toBe(5);
      expect(user?.lockedUntil).not.toBeNull();
      expect(user!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  it("login bem sucedido reseta o contador e o trava", async () => {
    const userId = tenant.users[1].id;
    await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
      await registerSuccessfulLogin(tx, userId);
      const user = await findUserById(tx, tenant.tenant.id, userId);
      expect(user?.failedLoginAttempts).toBe(0);
      expect(user?.lockedUntil).toBeNull();
    });
  });
});

describe("sessao (ADR-007): JWT e' so' ponteiro, Session em banco e' a fonte de verdade", () => {
  it("sessao criada e' valida ate ser revogada", async () => {
    const userId = tenant.users[0].id;
    await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
      const session = await createSession(tx, {
        tenantId: tenant.tenant.id,
        userId,
        expiresAt: new Date(Date.now() + 60_000),
      });

      const valid = await findValidSession(tx, session.id);
      expect(valid?.id).toBe(session.id);

      await revokeSession(tx, session.id);
      const afterLogout = await findValidSession(tx, session.id);
      expect(afterLogout).toBeNull();
    });
  });

  it("sessao expirada nao e valida mesmo sem revogacao explicita", async () => {
    const userId = tenant.users[0].id;
    await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
      const session = await createSession(tx, {
        tenantId: tenant.tenant.id,
        userId,
        expiresAt: new Date(Date.now() - 1000),
      });
      const valid = await findValidSession(tx, session.id);
      expect(valid).toBeNull();
    });
  });

  it("revokeOtherUserSessions preserva a sessao atual e revoga as demais", async () => {
    const userId = tenant.users[0].id;
    await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
      const keep = await createSession(tx, { tenantId: tenant.tenant.id, userId, expiresAt: new Date(Date.now() + 60_000) });
      const other = await createSession(tx, { tenantId: tenant.tenant.id, userId, expiresAt: new Date(Date.now() + 60_000) });

      await revokeOtherUserSessions(tx, userId, keep.id);

      expect(await findValidSession(tx, keep.id)).not.toBeNull();
      expect(await findValidSession(tx, other.id)).toBeNull();
    });
  });
});

describe("CRUD de colaborador nunca mexe em credenciais por acidente", () => {
  it("updateEmployeeProfile nao altera password_hash/cpf_hash/must_change_password", async () => {
    const userId = tenant.users[2].id;
    await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
      const before = await findUserById(tx, tenant.tenant.id, userId);

      await updateEmployeeProfile(tx, tenant.tenant.id, userId, {
        fullName: "Nome Atualizado",
        branchId: before!.branchId,
        role: "manager",
        birthDate: null,
        hiredAt: null,
        phone: null,
        email: null,
      });

      const after = await findUserById(tx, tenant.tenant.id, userId);
      expect(after?.fullName).toBe("Nome Atualizado");
      expect(after?.role).toBe("manager");
      expect(after?.passwordHash).toBe(before?.passwordHash);
      expect(after?.cpfHash).toBe(before?.cpfHash);
      expect(after?.mustChangePassword).toBe(before?.mustChangePassword);
    });
  });
});

describe("filial: exclusao bloqueada quando ha colaborador vinculado", () => {
  it("countUsersInBranch reporta uso e a filial sobrevive", async () => {
    await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
      const [branch] = await findBranchesByTenant(tx, tenant.tenant.id);
      const count = await countUsersInBranch(tx, tenant.tenant.id, branch.id);
      expect(count).toBeGreaterThan(0);
      // A acao real checa countUsersInBranch antes de chamar deleteBranch —
      // aqui confirmamos que a FK (onDelete: Restrict) tambem barra na unha.
      await expect(deleteBranch(tx, tenant.tenant.id, branch.id)).rejects.toThrow();
    });
  });
});

describe("import CSV: idempotente por matricula", () => {
  it("reimport da mesma matricula atualiza cadastro sem tocar senha/cpf_hash", async () => {
    await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
      const [branch] = await findBranchesByTenant(tx, tenant.tenant.id);
      const registrationCode = `CSV-TEST-${randomUUID().slice(0, 8)}`;

      const created = await applyEmployeeCsvRow(tx, tenant.tenant.id, {
        fullName: "Colaborador CSV",
        registrationCode,
        cpf: "11122233344",
        branchCode: branch.code,
        role: "employee",
      });
      expect(created.status).toBe("created");
      const provisionalPassword = created.status === "created" ? created.provisionalPassword : "";
      expect(provisionalPassword).toHaveLength(10);

      const afterCreate = await findUserByCpfHash(tx, tenant.tenant.id, hashCpf("11122233344"));
      const passwordHashAfterCreate = afterCreate!.passwordHash;

      const updated = await applyEmployeeCsvRow(tx, tenant.tenant.id, {
        fullName: "Colaborador CSV Renomeado",
        registrationCode,
        cpf: "99988877766", // CPF "diferente" na reimport — decisao tecnica: nao atualiza cpf_hash
        branchCode: branch.code,
        role: "manager",
      });
      expect(updated.status).toBe("updated");

      const afterUpdate = await findUserByCpfHash(tx, tenant.tenant.id, hashCpf("11122233344"));
      expect(afterUpdate?.fullName).toBe("Colaborador CSV Renomeado");
      expect(afterUpdate?.role).toBe("manager");
      expect(afterUpdate?.passwordHash).toBe(passwordHashAfterCreate);
      expect(afterUpdate?.mustChangePassword).toBe(true);

      const byNewCpf = await findUserByCpfHash(tx, tenant.tenant.id, hashCpf("99988877766"));
      expect(byNewCpf).toBeNull();
    });
  });

  it("filial inexistente produz erro sem criar o colaborador", async () => {
    await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
      const result = await applyEmployeeCsvRow(tx, tenant.tenant.id, {
        fullName: "Fulano",
        registrationCode: `CSV-ERR-${randomUUID().slice(0, 8)}`,
        cpf: "55566677788",
        branchCode: "FILIAL-QUE-NAO-EXISTE",
        role: "employee",
      });
      expect(result.status).toBe("error");
    });
  });
});

describe("toggles de consentimento persistem com timestamp", () => {
  it("so carimba changed_at quando o valor de fato muda", async () => {
    const userId = tenant.users[0].id;
    await withTenant({ tenantId: tenant.tenant.id }, async (tx) => {
      const before = await findUserById(tx, tenant.tenant.id, userId);

      await updateConsentToggles(tx, userId, { birthdayVisible: !before!.birthdayVisible, photoVisible: before!.photoVisible });
      const afterFirstChange = await findUserById(tx, tenant.tenant.id, userId);
      expect(afterFirstChange?.birthdayVisibleChangedAt).not.toBeNull();
      expect(afterFirstChange?.photoVisibleChangedAt).toBeNull();

      // Reenviar o mesmo valor nao deve "renovar" o timestamp.
      const stampedAt = afterFirstChange!.birthdayVisibleChangedAt;
      await updateConsentToggles(tx, userId, {
        birthdayVisible: afterFirstChange!.birthdayVisible,
        photoVisible: afterFirstChange!.photoVisible,
      });
      const afterResubmit = await findUserById(tx, tenant.tenant.id, userId);
      expect(afterResubmit?.birthdayVisibleChangedAt?.getTime()).toBe(stampedAt?.getTime());
    });
  });
});
