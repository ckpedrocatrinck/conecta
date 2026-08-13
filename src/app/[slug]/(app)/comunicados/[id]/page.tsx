import { notFound } from "next/navigation";
import { requireOnboardedSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { findAnnouncementById, isAnnouncementVisibleToUser } from "@/lib/repositories/announcement.repository";
import { findAnnouncementVersionHistory } from "@/lib/repositories/announcement-version.repository";
import { recordAnnouncementReadOnce, findAnnouncementReadsForUser } from "@/lib/repositories/announcement-read.repository";
import { findAnnouncementAcksForUser } from "@/lib/repositories/announcement-ack.repository";
import { buildAnnouncementReaderState } from "@/lib/announcements/reader-state";
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
      </div>

      <RichTextContent html={latest.body} />

      {announcement.criticality === "requires_ack" &&
        (state.ackSatisfied ? (
          <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-border bg-primary-subtle px-4 py-3 text-primary-deep">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
            </span>
            <p className="text-meta font-semibold">
              Ciência confirmada em {formatDateTimeSaoPaulo(state.lastAckedAt as Date)}
            </p>
          </div>
        ) : (
          <form action={ackAnnouncementAction} className="flex flex-col gap-2">
            <input type="hidden" name="announcementId" value={announcement.id} />
            <input type="hidden" name="versionId" value={latest.id} />
            <AckSubmitButton />
          </form>
        ))}
    </div>
  );
}
