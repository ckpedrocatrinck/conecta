"use client";

import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import {
  MAX_POST_ATTACHMENTS,
  kindForContentType,
  maxBytesForContentType,
} from "@/lib/storage/media-constraints";
import { formatBytes } from "@/lib/format/format-bytes";
import { confirmPostAttachmentUploadAction, removePostMediaAction, requestPostAttachmentUploadUrl } from "./actions";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,application/pdf";

export type ExistingAttachment = {
  id: string;
  kind: "image" | "document";
  viewUrl: string | null;
  originalName: string | null;
  sizeBytes: number | null;
};

type QueueItem = { name: string; progress: number; status: "uploading" | "done" | "error"; error?: string };

function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("upload falhou")));
    xhr.onerror = () => reject(new Error("upload falhou"));
    xhr.send(file);
  });
}

export function PostPhotoUpload({
  postId,
  existingMedia,
}: {
  postId: string;
  existingMedia: ExistingAttachment[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    if (existingMedia.length + files.length > MAX_POST_ATTACHMENTS) {
      setError(`Máximo de ${MAX_POST_ATTACHMENTS} anexos por post.`);
      event.target.value = "";
      return;
    }

    // Validacao antecipada (feedback rapido) — o servidor e' a autoridade real
    // (sniff do tipo REAL + tamanho no confirm).
    for (const file of files) {
      if (!kindForContentType(file.type)) {
        setError(`"${file.name}": tipo não permitido. Aceitamos JPG, PNG, WEBP ou PDF.`);
        event.target.value = "";
        return;
      }
      const limit = maxBytesForContentType(file.type);
      if (limit !== null && file.size > limit) {
        setError(`"${file.name}" excede o limite (imagem 5 MB, PDF 10 MB).`);
        event.target.value = "";
        return;
      }
    }

    setError(null);
    setQueue(files.map((f) => ({ name: f.name, progress: 0, status: "uploading" as const })));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const requested = await requestPostAttachmentUploadUrl(postId, file.type, file.size);
        if ("error" in requested) {
          setQueue((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: "error", error: requested.error } : it)));
          continue;
        }
        await uploadWithProgress(requested.uploadUrl, file, (pct) => {
          setQueue((prev) => prev.map((it, idx) => (idx === i ? { ...it, progress: pct } : it)));
        });
        const confirmed = await confirmPostAttachmentUploadAction(postId, requested.key, file.name);
        if (!confirmed.ok) {
          setQueue((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: "error", error: confirmed.error } : it)));
          continue;
        }
        setQueue((prev) => prev.map((it, idx) => (idx === i ? { ...it, progress: 100, status: "done" } : it)));
      } catch {
        setQueue((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: "error", error: "erro no envio" } : it)));
      }
    }

    router.refresh();
    event.target.value = "";
  }

  return (
    <div className="flex flex-col gap-3">
      {existingMedia.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            {existingMedia
              .filter((m) => m.kind === "image")
              .map((media) => (
                <div key={media.id} className="relative">
                  <ImageLightbox src={media.viewUrl ?? ""} className="size-20 rounded-lg border border-border" />
                  <ConfirmDialog
                    triggerLabel="×"
                    triggerAriaLabel="Remover anexo"
                    triggerClassName="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive p-0 text-xs text-destructive-foreground"
                    title="Remover este anexo?"
                    description="O anexo deixa de aparecer no post. Esta ação não pode ser desfeita."
                    confirmLabel="Remover"
                    action={removePostMediaAction}
                    hiddenFields={{ id: postId, mediaId: media.id }}
                  />
                </div>
              ))}
          </div>
          {existingMedia
            .filter((m) => m.kind === "document")
            .map((media) => (
              <div
                key={media.id}
                className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-card p-3"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
                  <FileText className="size-5" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {media.originalName ?? "Documento.pdf"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    PDF{media.sizeBytes != null ? ` · ${formatBytes(media.sizeBytes)}` : ""}
                  </span>
                </span>
                <ConfirmDialog
                  triggerLabel="Remover"
                  triggerAriaLabel="Remover anexo"
                  triggerClassName="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-destructive"
                  title="Remover este anexo?"
                  description="O anexo deixa de aparecer no post. Esta ação não pode ser desfeita."
                  confirmLabel="Remover"
                  action={removePostMediaAction}
                  hiddenFields={{ id: postId, mediaId: media.id }}
                />
              </div>
            ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={existingMedia.length >= MAX_POST_ATTACHMENTS}
        onClick={() => fileInputRef.current?.click()}
        className="self-start"
      >
        Enviar anexos
      </Button>
      <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} multiple onChange={handleFileChange} className="sr-only" />

      {queue.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {queue.map((item, idx) => (
            <li key={idx}>
              {item.name} —{" "}
              {item.status === "error" ? (
                <span className="text-destructive">{item.error ?? "erro no envio"}</span>
              ) : (
                `${item.progress}%`
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
