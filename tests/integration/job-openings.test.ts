import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantFixtures } from "../../prisma/seed-data";
import { withTenant } from "../../src/lib/db/with-tenant";
import {
  cancelJobApplication,
  createJobApplication,
  createJobOpening,
  closeJobOpeningManually,
  findApplicantsForJobOpening,
  findJobApplication,
  findOpenJobOpeningsForEmployee,
} from "../../src/lib/repositories/job-opening.repository";
import { toApplicantView } from "../../src/lib/jobs/build-job-opening-view";
import { buildJobApplicationExportCsv } from "../../src/lib/csv/job-application-export";
import { isJobOpeningAcceptingApplications } from "../../src/lib/jobs/is-open";

const ownerDb = new PrismaClient();

let tenant: Awaited<ReturnType<typeof buildTenantFixtures>>;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  tenant = await buildTenantFixtures(ownerDb, {
    name: `Job Openings Test ${suffix}`,
    slug: `job-openings-test-${suffix}`,
    branchCount: 2,
    userCount: 10,
    cpfSeedOffset: 850,
    includeSampleAnnouncements: false,
  });
}, 60_000);

afterAll(async () => {
  // post/jobOpening carregam created_by (onDelete: Restrict) apontando pra
  // User — precisam sair antes do usuario, mesma ordem de
  // tenant-isolation.test.ts/pending-panel.test.ts.
  await ownerDb.jobApplication.deleteMany({ where: { tenantId: tenant.tenant.id } });
  await ownerDb.jobOpening.deleteMany({ where: { tenantId: tenant.tenant.id } });
  await ownerDb.post.deleteMany({ where: { tenantId: tenant.tenant.id } });
  await ownerDb.benefit.deleteMany({ where: { tenantId: tenant.tenant.id } });
  await ownerDb.user.deleteMany({ where: { tenantId: tenant.tenant.id } });
  await ownerDb.tenant.deleteMany({ where: { id: tenant.tenant.id } });
  await ownerDb.$disconnect();
});

const FUTURE = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000);

function createJob(overrides: Partial<Parameters<typeof createJobOpening>[1]> = {}) {
  return withTenant({ tenantId: tenant.tenant.id }, (tx) =>
    createJobOpening(tx, {
      tenantId: tenant.tenant.id,
      title: "Vaga de teste",
      description: "Descrição de teste",
      deadline: FUTURE,
      createdBy: tenant.users[0].id,
      ...overrides,
    }),
  );
}

describe("candidatura — idempotência", () => {
  it("candidatura duplicada é impossível (constraint única job_opening_id+user_id)", async () => {
    const job = await createJob();
    const applicant = tenant.users[4];

    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createJobApplication(tx, tenant.tenant.id, job.id, applicant.id, null),
    );

    await expect(
      withTenant({ tenantId: tenant.tenant.id }, (tx) =>
        createJobApplication(tx, tenant.tenant.id, job.id, applicant.id, "segunda tentativa"),
      ),
    ).rejects.toMatchObject({ code: "P2002" } satisfies Partial<Prisma.PrismaClientKnownRequestError>);

    const applications = await ownerDb.jobApplication.findMany({ where: { jobOpeningId: job.id } });
    expect(applications.length).toBe(1);
  });

  it("cancelar (delete) e recandidatar-se depois funciona", async () => {
    const job = await createJob();
    const applicant = tenant.users[5];

    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createJobApplication(tx, tenant.tenant.id, job.id, applicant.id, null),
    );
    const afterApply = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findJobApplication(tx, tenant.tenant.id, job.id, applicant.id),
    );
    expect(afterApply).not.toBeNull();

    await withTenant({ tenantId: tenant.tenant.id }, (tx) => cancelJobApplication(tx, tenant.tenant.id, job.id, applicant.id));
    const afterCancel = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findJobApplication(tx, tenant.tenant.id, job.id, applicant.id),
    );
    expect(afterCancel).toBeNull();

    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createJobApplication(tx, tenant.tenant.id, job.id, applicant.id, "recandidatando"),
    );
    const afterReapply = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findJobApplication(tx, tenant.tenant.id, job.id, applicant.id),
    );
    expect(afterReapply?.note).toBe("recandidatando");
  });
});

describe("vaga fechada/vencida bloqueia candidatura", () => {
  it("status=closed não aceita candidatura (isJobOpeningAcceptingApplications)", async () => {
    const job = await createJob();
    await withTenant({ tenantId: tenant.tenant.id }, (tx) => closeJobOpeningManually(tx, tenant.tenant.id, job.id));
    const closedJob = await ownerDb.jobOpening.findUniqueOrThrow({ where: { id: job.id } });

    expect(isJobOpeningAcceptingApplications(closedJob)).toBe(false);
  });

  it("prazo vencido não aceita candidatura mesmo com status ainda 'open' no banco", async () => {
    const job = await createJob({ deadline: PAST });

    expect(job.status).toBe("open");
    expect(isJobOpeningAcceptingApplications(job)).toBe(false);
  });

  it("vaga aberta e dentro do prazo aceita candidatura", async () => {
    const job = await createJob();
    expect(isJobOpeningAcceptingApplications(job)).toBe(true);
  });
});

describe("listagem do colaborador (findOpenJobOpeningsForEmployee)", () => {
  it("some vaga fechada e vaga com prazo vencido; filtro de filial e' opcional (nao restringe)", async () => {
    const branchA = tenant.branches[0];
    const branchB = tenant.branches[1];

    const openGeral = await createJob({ title: "Aberta geral" });
    const openBranchB = await createJob({ title: "Aberta filial B", branchId: branchB.id });
    const closed = await createJob({ title: "Fechada" });
    await withTenant({ tenantId: tenant.tenant.id }, (tx) => closeJobOpeningManually(tx, tenant.tenant.id, closed.id));
    const expired = await createJob({ title: "Vencida", deadline: PAST });

    const allOpen = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findOpenJobOpeningsForEmployee(tx, tenant.tenant.id, {}),
    );
    const ids = allOpen.map((j) => j.id);
    expect(ids).toContain(openGeral.id);
    expect(ids).toContain(openBranchB.id);
    expect(ids).not.toContain(closed.id);
    expect(ids).not.toContain(expired.id);

    // Filtro por filial A: vaga geral (branchId null) e vaga da propria
    // filial B NAO aparecem quando o filtro e' A (filtro estrito por
    // branchId, igual ao /aniversariantes) — filial e' recorte, aplicado
    // so' quando o colaborador escolhe.
    const filteredByA = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findOpenJobOpeningsForEmployee(tx, tenant.tenant.id, { branchId: branchA.id }),
    );
    expect(filteredByA.map((j) => j.id)).not.toContain(openBranchB.id);

    // Sem filtro (leitura padrao da tela /vagas): vaga de QUALQUER filial e
    // geral aparecem juntas — filial nao e' controle de acesso.
    expect(ids).toContain(openBranchB.id);
    expect(ids).toContain(openGeral.id);
  });
});

describe("export de candidatos (CSV)", () => {
  it("gera uma linha por candidato com os campos esperados", async () => {
    const job = await createJob({ title: "Vaga para export" });
    const applicantA = tenant.users[4];
    const applicantB = tenant.users[5];

    await ownerDb.user.update({ where: { id: applicantA.id }, data: { phone: "(22) 99999-9999" } });

    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createJobApplication(tx, tenant.tenant.id, job.id, applicantA.id, "quero muito"),
    );
    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createJobApplication(tx, tenant.tenant.id, job.id, applicantB.id, null),
    );

    const csvExport = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      buildJobApplicationExportCsv(tx, tenant.tenant.id, job.id, new Date()),
    );

    expect(csvExport).not.toBeNull();
    expect(csvExport?.rowCount).toBe(2);
    expect(csvExport?.csv).toContain(applicantA.fullName);
    expect(csvExport?.csv).toContain(applicantB.fullName);
    expect(csvExport?.csv).toContain("quero muito");
    // INC-021: coluna Telefone presente; candidato sem telefone gera celula vazia, nao "null".
    expect(csvExport?.csv).toContain("Telefone");
    expect(csvExport?.csv).toContain("(22) 99999-9999");
  });
});

describe("candidatos trazem o telefone via join com User (INC-021)", () => {
  it("findApplicantsForJobOpening + toApplicantView propagam o phone (null quando o colaborador nao tem)", async () => {
    const job = await createJob({ title: "Vaga para telefone" });
    const withPhone = tenant.users[6];
    const withoutPhone = tenant.users[7];

    await ownerDb.user.update({ where: { id: withPhone.id }, data: { phone: "22988887777" } });
    await ownerDb.user.update({ where: { id: withoutPhone.id }, data: { phone: null } });

    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createJobApplication(tx, tenant.tenant.id, job.id, withPhone.id, null),
    );
    await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      createJobApplication(tx, tenant.tenant.id, job.id, withoutPhone.id, null),
    );

    const applicants = await withTenant({ tenantId: tenant.tenant.id }, (tx) =>
      findApplicantsForJobOpening(tx, tenant.tenant.id, job.id),
    );
    const branchNameById = new Map(tenant.branches.map((b) => [b.id, b.name]));
    const views = applicants.map((a) => toApplicantView(a, branchNameById));

    expect(views.find((v) => v.userId === withPhone.id)?.phone).toBe("22988887777");
    expect(views.find((v) => v.userId === withoutPhone.id)?.phone).toBeNull();
  });
});
