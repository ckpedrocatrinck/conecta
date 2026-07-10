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
  /** Evita CPFs/matriculas iguais quando varios tenants sao criados no mesmo teste. */
  cpfSeedOffset?: number;
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
          name: BRANCH_NAMES[i] ?? `Filial ${i + 1}`,
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

  const announcementsData = [
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

  const postsData = [
    { type: "recognition" as const, title: "Foi Show da semana" },
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

  return { tenant, branches, users, announcements, posts, jobOpenings };
}
