import { sanitizeAnnouncementBody } from "@/lib/sanitize/announcement-body";

/**
 * Renderer read-only do corpo de um comunicado. Sanitiza de novo aqui
 * (alem da sanitizacao ja feita na escrita) — defesa em profundidade contra
 * "nunca renderizar HTML nao sanitizado" (ADR-001 / design-system).
 */
export function RichTextContent({ html }: { html: string }) {
  return (
    <div
      className="flex flex-col gap-2 text-sm [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
      dangerouslySetInnerHTML={{ __html: sanitizeAnnouncementBody(html) }}
    />
  );
}
