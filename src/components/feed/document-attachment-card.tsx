import { FileText } from "lucide-react";
import type { FeedAttachment } from "@/lib/feed/build-feed-view";
import { formatBytes } from "@/lib/format/format-bytes";

/** Anexo do tipo documento (PDF) no feed. Nao renderiza inline: mostra um card
 * com icone + nome + tamanho e abre via /api/anexo/[id], que re-assina o link
 * no clique (a view URL tem TTL curto; o feed pode ficar aberto mais que isso).
 * Empilhado e com min-w-0/truncate para caber em 360px sem scroll horizontal. */
export function DocumentAttachmentCard({ attachment }: { attachment: FeedAttachment }) {
  const name = attachment.originalName ?? "Documento.pdf";
  const size = attachment.sizeBytes != null ? formatBytes(attachment.sizeBytes) : null;

  return (
    <a
      href={`/api/anexo/${attachment.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-card p-3 transition-colors hover:bg-muted"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
        <FileText className="size-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground">PDF{size ? ` · ${size}` : ""} · Abrir</span>
      </span>
    </a>
  );
}
