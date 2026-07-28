"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { announcementBodyHasContent, sanitizeAnnouncementBody } from "@/lib/sanitize/announcement-body";
import { createAnnouncementDraft } from "@/lib/repositories/announcement.repository";
import { createAnnouncementVersion } from "@/lib/repositories/announcement-version.repository";
import { replaceAnnouncementAudience } from "@/lib/repositories/announcement-audience.repository";
import { recordAuditLog } from "@/lib/repositories/audit-log.repository";
import {
  createAndPublishAnnouncement,
  createAndScheduleAnnouncement,
  type NewAnnouncementInput,
} from "@/lib/announcements/create-with-publication";
import { fromDatetimeLocalSaoPaulo } from "@/lib/dates/format-datetime";

const VALID_CRITICALITY = new Set(["info", "requires_ack"]);

export async function createAnnouncementDraftAction(formData: FormData) {
  const session = await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const criticality = String(formData.get("criticality") ?? "");
  const branchIds = formData.getAll("branchIds").map(String);

  if (!title || !body || !category || !VALID_CRITICALITY.has(criticality)) {
    redirect(`/${session.tenantSlug}/admin/comunicados/novo?erro=obrigatorio`);
  }

  const announcementId = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const announcement = await createAnnouncementDraft(tx, {
      tenantId: session.tenantId,
      category,
      criticality: criticality as "info" | "requires_ack",
      createdBy: session.userId,
    });

    await createAnnouncementVersion(tx, {
      tenantId: session.tenantId,
      announcementId: announcement.id,
      title,
      body: sanitizeAnnouncementBody(body),
      createdBy: session.userId,
    });

    await replaceAnnouncementAudience(tx, session.tenantId, announcement.id, branchIds);

    await recordAuditLog(tx, {
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "announcement.create_draft",
      entity: "Announcement",
      entityId: announcement.id,
    });

    return announcement.id;
  });

  redirect(`/${session.tenantSlug}/admin/comunicados/${announcementId}`);
}

type ParsedAnnouncementForm = Omit<NewAnnouncementInput, "tenantId" | "createdBy">;

/**
 * Le' e valida o formulario da tela `novo` para os caminhos que PUBLICAM
 * (publicar agora / agendar). Validacao 100% server-side, e a do corpo
 * acontece DEPOIS da sanitizacao (INC-018 item 4) — o cliente pode mandar
 * "<p></p>" ou so' tags que a allowlist descarta.
 *
 * Devolve `null` quando algo obrigatorio falta; quem chama redireciona com
 * mensagem e NADA e' escrito no banco (nem rascunho).
 */
function parseAnnouncementFormForPublication(formData: FormData): ParsedAnnouncementForm | null {
  const title = String(formData.get("title") ?? "").trim();
  const body = sanitizeAnnouncementBody(String(formData.get("body") ?? ""));
  const category = String(formData.get("category") ?? "").trim();
  const criticality = String(formData.get("criticality") ?? "");
  const branchIds = formData.getAll("branchIds").map(String).filter(Boolean);

  if (!title || !announcementBodyHasContent(body) || !category || !VALID_CRITICALITY.has(criticality)) {
    return null;
  }

  return { title, body, category, criticality: criticality as "info" | "requires_ack", branchIds };
}

export async function createAndPublishAnnouncementAction(formData: FormData) {
  const session = await requireAdmin();

  const parsed = parseAnnouncementFormForPublication(formData);
  if (!parsed) {
    redirect(`/${session.tenantSlug}/admin/comunicados/novo?erro=obrigatorio`);
  }

  // Uma unica transacao (`withTenant`) cobre criar + versionar + publicar:
  // falha em qualquer ponto reverte tudo, sem rascunho orfao (INC-018 item 3).
  let announcementId: string;
  try {
    const result = await withTenant({ tenantId: session.tenantId }, (tx) =>
      createAndPublishAnnouncement(tx, { ...parsed, tenantId: session.tenantId, createdBy: session.userId }),
    );
    announcementId = result.announcementId;
  } catch (error) {
    // Sem dado pessoal no log (regra do projeto): so' a mensagem do erro.
    console.error(
      "[INC-018] create+publish falhou; transacao revertida:",
      error instanceof Error ? error.message : String(error),
    );
    redirect(`/${session.tenantSlug}/admin/comunicados/novo?erro=falha-publicacao`);
  }

  redirect(`/${session.tenantSlug}/admin/comunicados/${announcementId}?ok=publicado`);
}

export async function createAndScheduleAnnouncementAction(formData: FormData) {
  const session = await requireAdmin();

  const parsed = parseAnnouncementFormForPublication(formData);
  if (!parsed) {
    redirect(`/${session.tenantSlug}/admin/comunicados/novo?erro=obrigatorio`);
  }

  // O input manda horario de parede de Sao Paulo; o banco guarda UTC.
  const publishAt = fromDatetimeLocalSaoPaulo(String(formData.get("publishAt") ?? ""));
  if (!publishAt) {
    redirect(`/${session.tenantSlug}/admin/comunicados/novo?erro=data-invalida`);
  }
  // Passado aqui e' ERRO DO USUARIO, nao "publica no proximo sweep"
  // (INC-018 item 5) — quem agenda esta escolhendo um momento futuro.
  if (publishAt.getTime() <= Date.now()) {
    redirect(`/${session.tenantSlug}/admin/comunicados/novo?erro=data-no-passado`);
  }

  let announcementId: string;
  try {
    const result = await withTenant({ tenantId: session.tenantId }, (tx) =>
      createAndScheduleAnnouncement(
        tx,
        { ...parsed, tenantId: session.tenantId, createdBy: session.userId },
        publishAt,
      ),
    );
    announcementId = result.announcementId;
  } catch (error) {
    console.error(
      "[INC-018] create+schedule falhou; transacao revertida:",
      error instanceof Error ? error.message : String(error),
    );
    redirect(`/${session.tenantSlug}/admin/comunicados/novo?erro=falha-agendamento`);
  }

  redirect(`/${session.tenantSlug}/admin/comunicados/${announcementId}?ok=agendado`);
}
