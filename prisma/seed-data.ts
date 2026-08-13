import type { PrismaClient } from "@prisma/client";
import { computeContentHash } from "../src/lib/crypto/content-hash";
import { hashCpf } from "../src/lib/crypto/cpf-hash";
import { hashPassword } from "../src/lib/crypto/password-hash";

export type BuildTenantFixturesOptions = {
  id?: string;
  adminUserId?: string;
  name: string;
  slug: string;
  branchCount?: number;
  userCount?: number;
  /** Nomes das filiais, na ordem de criacao. Falta de entrada num indice cai
   * no default (`BRANCH_NAMES` / `Filial N`). Usado pelo seed de demonstracao
   * (INC-027) para nomes genericos por zona em vez do default "Filial X". */
  branchNames?: string[];
  /** Evita CPFs/matriculas iguais quando varios tenants sao criados no mesmo teste. */
  cpfSeedOffset?: number;
  /** Default true. Testes que exercitam a numeracao/sequencia de
   * comunicados do zero (INC-004) precisam de um tenant sem nenhum
   * announcement/seq_number pre-existente — passar false evita colisao com
   * a sequencia de exemplo abaixo (seq 1..3) e evita que a limpeza desse
   * teste precise desabilitar o trigger de imutabilidade de
   * announcement_acks (menos superficie para a corrida entre arquivos de
   * teste que rodam em paralelo e compartilham esse ALTER TABLE global). */
  includeSampleAnnouncements?: boolean;
};

const BRANCH_NAMES = ["Filial Centro", "Filial Norte", "Filial Sul", "Filial Leste", "Filial Oeste"];

/**
 * Cria um tenant completo (filiais, usuarios, comunicados com versoes/acks
 * parciais, posts e vagas) usando um client de owner (bypassa RLS de
 * proposito — e' uma operacao administrativa). Reaproveitada por
 * prisma/seed.ts (1 tenant de dev) e pelos testes de isolamento (tenant A
 * + tenant B).
 */
export async function buildTenantFixtures(db: PrismaClient, opts: BuildTenantFixturesOptions) {
  const branchCount = opts.branchCount ?? 3;
  const userCount = opts.userCount ?? 30;
  const cpfOffset = opts.cpfSeedOffset ?? 0;

  const tenant = await db.tenant.create({
    data: {
      id: opts.id,
      name: opts.name,
      slug: opts.slug,
      status: "active",
      plan: "pilot",
    },
  });

  const branches = [];
  for (let i = 0; i < branchCount; i++) {
    branches.push(
      await db.branch.create({
        data: {
          tenantId: tenant.id,
          name: opts.branchNames?.[i] ?? BRANCH_NAMES[i] ?? `Filial ${i + 1}`,
          code: `F${i + 1}`,
        },
      }),
    );
  }

  const defaultPasswordHash = await hashPassword("Trocar123!");

  const users = [];
  for (let i = 0; i < userCount; i++) {
    const isFirst = i === 0;
    const role: "admin" | "manager" | "employee" = isFirst ? "admin" : i < 4 ? "manager" : "employee";
    const branch = branches[i % branches.length];
    const cpfDigits = String(10_000_000_000 + cpfOffset * 1000 + i).padStart(11, "0");

    users.push(
      await db.user.create({
        data: {
          id: isFirst ? opts.adminUserId : undefined,
          tenantId: tenant.id,
          branchId: branch.id,
          role,
          fullName: `Colaborador ${cpfOffset}-${i + 1}`,
          registrationCode: `MAT-${cpfOffset}-${String(i + 1).padStart(4, "0")}`,
          cpfHash: hashCpf(cpfDigits),
          birthDate: new Date(1985 + (i % 20), i % 12, (i % 27) + 1),
          birthdayVisible: i % 3 !== 0,
          hiredAt: new Date(2020 + (i % 5), i % 12, 1),
          status: i === userCount - 1 ? "inactive" : "active",
          passwordHash: defaultPasswordHash,
          mustChangePassword: true,
        },
      }),
    );
  }

  const admin = users[0];
  const year = new Date().getUTCFullYear();

  const announcementsData = opts.includeSampleAnnouncements === false
    ? []
    : [
        { category: "seguranca", criticality: "requires_ack" as const, status: "published" as const, seq: 1 },
        {
          category: "rh",
          criticality: "requires_ack" as const,
          status: "published" as const,
          seq: 2,
          branchOnly: true,
        },
        { category: "aviso", criticality: "info" as const, status: "published" as const, seq: 3 },
        { category: "rh", criticality: "info" as const, status: "draft" as const },
      ];

  const announcements = [];
  for (const a of announcementsData) {
    const announcement = await db.announcement.create({
      data: {
        tenantId: tenant.id,
        seqNumber: a.status === "draft" ? null : a.seq,
        year,
        category: a.category,
        criticality: a.criticality,
        status: a.status,
        publishAt: a.status === "published" ? new Date() : null,
        createdBy: admin.id,
      },
    });

    const title = `Comunicado ${a.category} #${announcement.seqNumber ?? "rascunho"}`;
    const body = `Corpo do comunicado de ${a.category} para ${tenant.name}.`;
    const version = await db.announcementVersion.create({
      data: {
        tenantId: tenant.id,
        announcementId: announcement.id,
        versionNumber: 1,
        title,
        body,
        contentHash: computeContentHash(title, body),
        createdBy: admin.id,
      },
    });

    if ("branchOnly" in a && a.branchOnly) {
      await db.announcementAudience.create({
        data: { announcementId: announcement.id, branchId: branches[0].id, tenantId: tenant.id },
      });
    }

    if (a.criticality === "requires_ack" && a.status === "published") {
      // Metade dos usuarios confirma — deixa pendencia real para os proximos INCs.
      const ackers = users.slice(0, Math.floor(users.length / 2));
      for (const user of ackers) {
        await db.announcementRead.create({
          data: { tenantId: tenant.id, announcementId: announcement.id, versionId: version.id, userId: user.id },
        });
        await db.announcementAck.create({
          data: {
            tenantId: tenant.id,
            announcementId: announcement.id,
            versionId: version.id,
            userId: user.id,
            contentHashAtAck: version.contentHash,
          },
        });
      }
    }

    announcements.push({ announcement, version });
  }

  // A amostra acima atribui seq_number direto (1..3), sem passar pelo
  // contador atomico (announcement_sequences, INC-004) — sem este upsert, a
  // PRIMEIRA publicacao real feita pelo app depois do seed colidiria com a
  // unique constraint (tenantId, year, seqNumber), porque o contador comecaria
  // do zero sem saber que 1..3 ja foram usados.
  const maxSeq = Math.max(0, ...announcementsData.filter((a) => a.status === "published").map((a) => a.seq ?? 0));
  if (maxSeq > 0) {
    await db.announcementSequence.upsert({
      where: { tenantId_year: { tenantId: tenant.id, year } },
      create: { tenantId: tenant.id, year, lastNumber: maxSeq },
      update: { lastNumber: maxSeq },
    });
  }

  const postsData = [
    { type: "recognition" as const, title: "Foi Show da semana", branchId: branches[0].id },
    { type: "tenure" as const, title: "5 anos de casa" },
    { type: "general" as const, title: "Aviso geral do mural" },
  ];

  const posts = [];
  for (const p of postsData) {
    const post = await db.post.create({
      data: {
        tenantId: tenant.id,
        type: p.type,
        title: p.title,
        body: `${p.title} — ${tenant.name}`,
        eventDate: new Date(),
        branchId: p.branchId,
        status: "published",
        createdBy: admin.id,
      },
    });
    await db.postPerson.create({
      data: { postId: post.id, userId: users[1].id, tenantId: tenant.id, label: "Homenageado" },
    });
    await db.postMedia.create({
      data: {
        postId: post.id,
        tenantId: tenant.id,
        mediaUrl: "https://example.com/placeholder.jpg",
        sortOrder: 0,
      },
    });
    await db.postReaction.create({
      data: { postId: post.id, userId: users[2].id, tenantId: tenant.id },
    });
    posts.push(post);
  }

  const jobOpenings = [];
  const jobsData = [
    { title: "Auxiliar de Estoque", shift: "manha" },
    { title: "Atendente", shift: "tarde" },
  ];
  for (const j of jobsData) {
    const jobOpening = await db.jobOpening.create({
      data: {
        tenantId: tenant.id,
        title: j.title,
        description: `Vaga para ${j.title} em ${tenant.name}.`,
        branchId: branches[0].id,
        shift: j.shift,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "open",
        createdBy: admin.id,
      },
    });
    await db.jobApplication.create({
      data: { tenantId: tenant.id, jobOpeningId: jobOpening.id, userId: users[3].id },
    });
    jobOpenings.push(jobOpening);
  }

  // Clube de Beneficios (INC-015): alguns beneficios em categorias variadas,
  // com sortOrder distinto (testa ordenacao) e um inativo (testa filtro
  // active=true do colaborador).
  const benefits = [];
  const benefitsData = [
    { category: "saude" as const, partnerName: "Academia Fit", title: "30% de desconto na mensalidade", description: "Apresente o cracha na recepcao. Valido para todos os planos.", sortOrder: 1, active: true },
    { category: "saude" as const, partnerName: "Farmacia Bem-Estar", title: "15% em medicamentos genericos", description: "Desconto na apresentacao do cracha.", sortOrder: 2, active: true },
    { category: "alimentacao" as const, partnerName: "Restaurante do Chef", title: "Almoco executivo com 20% off", description: "De segunda a sexta, no horario de almoco.", sortOrder: 1, active: true },
    { category: "educacao" as const, partnerName: "Escola de Idiomas Global", title: "Bolsa de 25% em cursos de ingles", description: "Extensivo a dependentes.", sortOrder: 1, active: false },
  ];
  for (const b of benefitsData) {
    const benefit = await db.benefit.create({
      data: {
        tenantId: tenant.id,
        category: b.category,
        partnerName: b.partnerName,
        title: b.title,
        description: b.description,
        sortOrder: b.sortOrder,
        active: b.active,
        createdBy: admin.id,
      },
    });
    benefits.push(benefit);
  }

  return { tenant, branches, users, announcements, posts, jobOpenings, benefits };
}
