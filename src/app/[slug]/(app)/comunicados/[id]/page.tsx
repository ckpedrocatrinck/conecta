import { notFound } from "next/navigation";
import { requireOnboardedSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { findAnnouncementById, isAnnouncementVisibleToUser } from "@/lib/repositories/announcement.repository";
import { findAnnouncementVersionHistory } from "@/lib/repositories/announcement-version.repository";
import { recordAnnouncementReadOnce, findAnnouncementReadsForUser } from "@/lib/repositories/announcement-read.repository";
import { findAnnouncementAcksForUser } from "@/lib/repositories/announcement-ack.repository";
import { buildAnnouncementReaderState } from "@/lib/announcements/reader-state";
import { buildAckProofView } from "@/lib/announcements/ack-proof";
import { formatAnnouncementCode } from "@/lib/announcements/publish";
import { formatAnnouncementCategory } from "@/lib/announcements/category-labels";
import { formatDateTimeSaoPaulo } from "@/lib/dates/format-datetime";
import { Check } from "lucide-react";
import { RichTextContent } from "@/components/announcements/rich-text-content";
import { PendingBanner } from "@/components/ui/pending-banner";
import { ackAnnouncementAction } from "./actions";
import { AckSubmitButton } from "./ack-submit-button";

export default async function LerComunicadoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireOnboardedSession();
  const { id } = await params;

  const data = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    const visible = await isAnnouncementVisibleToUser(tx, session.tenantId, session.userId, id);
    if (!visible) return null;

    const announcement = await findAnnouncementById(tx, session.tenantId, id);
    if (!announcement) return null;

    const versions = await findAnnouncementVersionHistory(tx, id);
    const latest = versions[0];
    if (!latest) return null;

    // Primeira abertura desta versao (ADR-006) — nunca atualiza em aberturas
    // subsequentes (recordAnnouncementReadOnce e' ON CONFLICT DO NOTHING).
    await recordAnnouncementReadOnce(tx, {
      tenantId: session.tenantId,
      announcementId: id,
      versionId: latest.id,
      userId: session.userId,
    });

    const [reads, acks] = await Promise.all([
      findAnnouncementReadsForUser(tx, session.tenantId, session.userId, [id]),
      findAnnouncementAcksForUser(tx, session.tenantId, session.userId, [id]),
    ]);

    const state = buildAnnouncementReaderState({
      criticality: announcement.criticality,
      versions,
      reads,
      acks,
    });

    return { announcement, latest, state };
  });

  if (!data) notFound();
  const { announcement, latest, state } = data;

  // announcement.publishAt e' garantido nao-nulo aqui: so' se chega nesta
  // tela para status published/archived (isAnnouncementVisibleToUser), e
  // publishAnnouncement() sempre grava publish_at na publicacao (INC-027
  // bloco 3.9).
  const publishAt = announcement.publishAt as Date;

  // Bloco de comprovacao (INC-027 bloco 3.12): so' faz sentido calcular a
  // "prova" (intervalo + versao confirmada) quando ha' ciencia satisfeita —
  // lastAckedAt/lastAckedVersionNumber so' existem nesse caso (reader-state.ts).
  const proof =
    announcement.criticality === "requires_ack" && state.ackSatisfied
      ? buildAckProofView({
          publishAt,
          ackedAt: state.lastAckedAt as Date,
          ackedVersionNumber: state.lastAckedVersionNumber as number,
          latestVersionNumber: state.latestVersion.versionNumber,
        })
      : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      {state.wasReopened && (
        <PendingBanner message="Este comunicado foi atualizado desde a sua última confirmação. Leia novamente e declare ciência." />
      )}

      <div className="flex flex-col gap-1">
        <span className="text-label uppercase text-muted-foreground">
          {announcement.seqNumber != null && announcement.year != null
            ? `${formatAnnouncementCode(announcement.seqNumber, announcement.year)} · `
            : ""}
          {formatAnnouncementCategory(announcement.category)}
        </span>
        <h1 className="text-display text-foreground">{latest.title}</h1>
        {/* So' comunicado sem exigencia de ciencia mostra a publicacao aqui,
            isolada — quando ha' ciencia, publicacao e confirmacao vivem juntas
            no bloco de comprovacao abaixo (era o defeito reportado: as duas
            datas que provam o intervalo do ADR-001 apareciam em pesos e
            lugares diferentes). */}
        {announcement.criticality !== "requires_ack" && (
          <p className="text-meta font-medium text-muted-foreground">Publicado em {formatDateTimeSaoPaulo(publishAt)}</p>
        )}
      </div>

      <RichTextContent html={latest.body} />

      {announcement.criticality === "requires_ack" &&
        (proof ? (
          <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-primary-subtle p-4">
            <div className="flex items-center gap-2 text-primary-deep">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
              </span>
              <span className="text-meta font-bold uppercase tracking-wide">Ciência confirmada</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-meta font-semibold text-foreground">Publicado</span>
                <span className="text-meta font-semibold text-foreground">{formatDateTimeSaoPaulo(publishAt)}</span>
              </div>
              {proof.intervalLabel && (
                <span className="text-center text-label text-subtle-foreground">{proof.intervalLabel}</span>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-meta font-semibold text-foreground">Confirmado</span>
                <span className="text-meta font-semibold text-foreground">
                  {formatDateTimeSaoPaulo(state.lastAckedAt as Date)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1 border-t border-border pt-2.5">
              <span className="text-meta text-muted-foreground">
                Versão {proof.ackedVersionNumber} confirmada
                {proof.confirmedOnEarlierVersion &&
                  ` — a versão atual é a ${proof.latestVersionNumber} (edição sem alteração material desde então)`}
              </span>
              <span className="text-label text-subtle-foreground">
                Este registro está vinculado ao conteúdo exato desta versão.
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-meta font-semibold text-foreground">Publicado</span>
              <span className="text-meta font-semibold text-foreground">{formatDateTimeSaoPaulo(publishAt)}</span>
            </div>
            <form action={ackAnnouncementAction} className="flex flex-col gap-2">
              <input type="hidden" name="announcementId" value={announcement.id} />
              <input type="hidden" name="versionId" value={latest.id} />
              <AckSubmitButton />
            </form>
          </div>
        ))}
    </div>
  );
}
