import type { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { computeContentHash } from "../src/lib/crypto/content-hash";
import { recordAuditLog } from "../src/lib/repositories/audit-log.repository";
import { writeMediaFile } from "../src/lib/storage/local-media-fs";

// Conteudo de demonstracao (INC-027 Bloco 3): comunicados, acks parciais e
// logo do tenant Rede Vale Verde. Isolado de seed-data.ts porque
// buildTenantFixtures() e' reaproveitado pelos testes de integracao — este
// modulo so' e' chamado por prisma/seed.ts (o seed de demo em si).

const DAY_MS = 24 * 60 * 60 * 1000;

type DemoBranch = { id: string; name: string };
type DemoUser = { id: string; branchId: string; status: string };

/** Conta de acks que mantem o percentual confirmado entre 60% e 70% do
 * publico-alvo — a tela de pendencias (nucleo do produto) nunca deve exibir
 * 0% nem 100% no seed de demonstracao. */
function calibratedAckCount(target: number): number {
  if (target <= 0) return 0;
  let count = Math.round(target * 0.65);
  let percent = (count / target) * 100;
  while (percent < 60 && count < target) {
    count++;
    percent = (count / target) * 100;
  }
  while (percent > 70 && count > 0) {
    count--;
    percent = (count / target) * 100;
  }
  return count;
}

/** Fatia rotacionada do publico-alvo — evita que os MESMOS usuarios apareçam
 * confirmados em todo comunicado (rotina real varia quem confirma cedo). */
function pickAckers(pool: DemoUser[], count: number, rotate: number): DemoUser[] {
  const start = pool.length ? rotate % pool.length : 0;
  const rotated = [...pool.slice(start), ...pool.slice(0, start)];
  return rotated.slice(0, count);
}

type AnnouncementSpec = {
  category: string;
  criticality: "info" | "requires_ack";
  status: "draft" | "scheduled" | "published" | "archived";
  title: string;
  body: string;
  /** Indice em `branches` — ausente = comunicado para toda a rede. */
  branchIndex?: number;
  /** Negativo = publishAt no passado (published/archived); positivo = no
   * futuro (scheduled). Ausente = sem publishAt (draft). */
  daysOffset?: number;
};

function buildAnnouncementSpecs(): AnnouncementSpec[] {
  return [
    {
      category: "seguranca",
      criticality: "requires_ack",
      status: "published",
      title: "Uso obrigatório de EPI na área de estoque",
      body: "A partir desta semana, o uso de luvas e calçado fechado é obrigatório em toda movimentação de estoque, em todas as lojas da rede. Confirme a ciência abaixo.",
      daysOffset: -30,
    },
    {
      category: "rh",
      criticality: "requires_ack",
      status: "published",
      title: "Atualização da política de banco de horas",
      body: "A política de banco de horas foi revisada: o saldo agora pode ser compensado em até 90 dias. Consulte o RH da sua loja e confirme a ciência.",
      daysOffset: -25,
    },
    {
      category: "operacional",
      criticality: "requires_ack",
      status: "published",
      title: "Novo procedimento de fechamento de caixa",
      body: "O checklist de fechamento de caixa mudou: conferência dupla obrigatória antes do envio ao malote. Confirme que leu o novo procedimento.",
      daysOffset: -20,
    },
    {
      category: "aviso",
      criticality: "info",
      status: "published",
      title: "Horário especial no feriado municipal",
      body: "Todas as lojas da rede funcionarão em horário reduzido (9h às 15h) no próximo feriado municipal.",
      daysOffset: -18,
    },
    {
      category: "rh",
      criticality: "info",
      status: "published",
      title: "Pesquisa de clima organizacional 2026",
      body: "A pesquisa de clima deste ano já está disponível. A participação é anônima e leva cerca de 5 minutos.",
      daysOffset: -15,
    },
    {
      category: "beneficios",
      criticality: "info",
      status: "published",
      title: "Nova parceria do Clube de Benefícios com academia",
      body: "Fechamos parceria com uma nova rede de academias, com desconto de 30% na mensalidade para toda a equipe. Detalhes na tela de Benefícios.",
      daysOffset: -12,
    },
    {
      category: "seguranca",
      criticality: "requires_ack",
      status: "published",
      title: "Uso obrigatório de colete refletivo no pátio de carga",
      body: "Colaboradores que circulam pelo pátio de carga e descarga devem usar colete refletivo durante todo o expediente. Confirme a ciência.",
      branchIndex: 2,
      daysOffset: -10,
    },
    {
      category: "operacional",
      criticality: "info",
      status: "published",
      title: "Atualização do sistema de controle de ponto",
      body: "O aplicativo de ponto foi atualizado. Em caso de erro na marcação, procure a liderança da sua loja.",
      daysOffset: -8,
    },
    {
      category: "rh",
      criticality: "requires_ack",
      status: "published",
      title: "Confirme o recebimento do novo cartão de vale-alimentação",
      body: "Os novos cartões de vale-alimentação já foram entregues às lideranças de cada loja. Confirme que recebeu o seu.",
      daysOffset: -5,
    },
    {
      category: "aviso",
      criticality: "info",
      status: "archived",
      title: "Comunicado sobre a reforma da loja Centro",
      body: "A loja Centro passou por reforma na fachada; o atendimento seguiu normal durante as obras. Período encerrado.",
      daysOffset: -90,
    },
    {
      category: "operacional",
      criticality: "info",
      status: "archived",
      title: "Mudança temporária de horário — loja Zona Norte",
      body: "Durante a reforma do estacionamento, a loja Zona Norte abriu 1 hora mais tarde por duas semanas. Período encerrado.",
      branchIndex: 1,
      daysOffset: -60,
    },
    {
      category: "seguranca",
      criticality: "info",
      status: "scheduled",
      title: "Treinamento de combate a incêndio",
      body: "Treinamento anual de combate a incêndio e evacuação, com data e horário a confirmar por loja.",
      daysOffset: 10,
    },
    {
      category: "rh",
      criticality: "info",
      status: "scheduled",
      title: "Recesso de fim de ano: aviso antecipado",
      body: "A escala de recesso de fim de ano será divulgada com antecedência. Este é um aviso prévio.",
      daysOffset: 25,
    },
    {
      category: "beneficios",
      criticality: "requires_ack",
      status: "draft",
      title: "Novo convênio odontológico (em elaboração)",
      body: "Rascunho: detalhes do novo convênio odontológico, ainda em negociação com o RH.",
    },
    {
      category: "operacional",
      criticality: "info",
      status: "draft",
      title: "Rascunho: revisão do uso do estacionamento de funcionários",
      body: "Rascunho: proposta de revisão das vagas de estacionamento reservadas para a equipe.",
    },
  ];
}

export type DemoAnnouncementResult = { title: string; status: string; percentConfirmed?: number };

/** Cria os ~15 comunicados de demonstração (categorias/criticidade/status
 * variados, incluindo agendados e arquivados) com acks parciais calibrados
 * entre 60% e 70% em cada `requires_ack` publicado — INC-027 Bloco 3. Usa
 * `db` (role owner, mesma conexão do resto do seed) e escreve direto, sem
 * passar pelas Server Actions (operação administrativa, como o resto do
 * seed). */
export async function seedDemoAnnouncements(
  db: PrismaClient,
  params: { tenantId: string; adminId: string; branches: DemoBranch[]; users: DemoUser[] },
): Promise<DemoAnnouncementResult[]> {
  const { tenantId, adminId, branches, users } = params;
  const activeUsers = users.filter((u) => u.status === "active");
  const now = Date.now();
  const year = new Date().getUTCFullYear();
  const specs = buildAnnouncementSpecs();

  let seq = 0;
  let ackRotation = 0;
  const results: DemoAnnouncementResult[] = [];

  for (const spec of specs) {
    const isNumbered = spec.status === "published" || spec.status === "archived";
    if (isNumbered) seq++;

    const publishAt = spec.daysOffset === undefined ? null : new Date(now + spec.daysOffset * DAY_MS);

    const announcement = await db.announcement.create({
      data: {
        tenantId,
        seqNumber: isNumbered ? seq : null,
        year,
        category: spec.category,
        criticality: spec.criticality,
        status: spec.status,
        publishAt: spec.status === "draft" ? null : publishAt,
        createdBy: adminId,
      },
    });

    const version = await db.announcementVersion.create({
      data: {
        tenantId,
        announcementId: announcement.id,
        versionNumber: 1,
        title: spec.title,
        body: spec.body,
        contentHash: computeContentHash(spec.title, spec.body),
        createdBy: adminId,
      },
    });

    let targetUsers = activeUsers;
    if (spec.branchIndex !== undefined) {
      const branch = branches[spec.branchIndex];
      await db.announcementAudience.create({
        data: { announcementId: announcement.id, branchId: branch.id, tenantId },
      });
      targetUsers = activeUsers.filter((u) => u.branchId === branch.id);
    }

    let percentConfirmed: number | undefined;
    if (spec.criticality === "requires_ack" && (spec.status === "published" || spec.status === "archived")) {
      const ackCount = calibratedAckCount(targetUsers.length);
      const ackers = pickAckers(targetUsers, ackCount, ackRotation);
      ackRotation += 5;
      for (const user of ackers) {
        await db.announcementRead.create({
          data: { tenantId, announcementId: announcement.id, versionId: version.id, userId: user.id },
        });
        await db.announcementAck.create({
          data: {
            tenantId,
            announcementId: announcement.id,
            versionId: version.id,
            userId: user.id,
            contentHashAtAck: version.contentHash,
          },
        });
      }
      percentConfirmed = targetUsers.length > 0 ? Math.round((ackers.length / targetUsers.length) * 100) : undefined;
    }

    if (spec.status === "published" || spec.status === "archived") {
      await recordAuditLog(db, {
        tenantId,
        actorUserId: adminId,
        action: spec.status === "archived" ? "announcement.archive" : "announcement.publish",
        entity: "Announcement",
        entityId: announcement.id,
        metadata: { seqNumber: announcement.seqNumber, year: announcement.year },
      });
    }

    results.push({ title: spec.title, status: spec.status, percentConfirmed });
  }

  if (seq > 0) {
    await db.announcementSequence.upsert({
      where: { tenantId_year: { tenantId, year } },
      create: { tenantId, year, lastNumber: seq },
      update: { lastNumber: seq },
    });
  }

  return results;
}

/** Sobe o wordmark do tenant de demonstração para o media storage local (mesma
 * key convention de `branding/{tenantId}/logo/{uuid}` usada pelo upload real
 * em admin/aparencia) e grava `Tenant.logoUrl`. Escreve o arquivo direto via
 * `writeMediaFile` (Node-side) — não passa pela URL assinada, que é
 * fluxo de browser. */
export async function seedTenantLogo(db: PrismaClient, tenantId: string, logoPath: string): Promise<string> {
  const bytes = await readFile(logoPath);
  const key = `branding/${tenantId}/logo/${randomUUID()}`;
  await writeMediaFile(key, bytes, "image/png");
  await db.tenant.update({ where: { id: tenantId }, data: { logoUrl: key } });
  await recordAuditLog(db, {
    tenantId,
    actorUserId: null,
    action: "tenant.appearance.update",
    entity: "Tenant",
    entityId: tenantId,
    metadata: { field: "logo", source: "seed" },
  });
  return key;
}
