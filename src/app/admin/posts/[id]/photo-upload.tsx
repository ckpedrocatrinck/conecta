"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { confirmPostMediaUploadAction, removePostMediaAction, requestPostMediaUploadUrl } from "./actions";

const MAX_PHOTOS = 5;
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";

type QueueItem = { name: string; progress: number; status: "uploading" | "done" | "error" };

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
  existingMedia: { id: string; viewUrl: string }[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    if (existingMedia.length + files.length > MAX_PHOTOS) {
      setError(`Máximo de ${MAX_PHOTOS} fotos por post.`);
      event.target.value = "";
      return;
    }

    setError(null);
    setQueue(files.map((f) => ({ name: f.name, progress: 0, status: "uploading" as const })));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const { uploadUrl, key } = await requestPostMediaUploadUrl(postId);
        await uploadWithProgress(uploadUrl, file, (pct) => {
          setQueue((prev) => prev.map((item, idx) => (idx === i ? { ...item, progress: pct } : item)));
        });
        await confirmPostMediaUploadAction(postId, key);
        setQueue((prev) => prev.map((item, idx) => (idx === i ? { ...item, progress: 100, status: "done" } : item)));
      } catch {
        setQueue((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "error" } : item)));
      }
    }

    router.refresh();
    event.target.value = "";
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {existingMedia.map((media) => (
          <div key={media.id} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada, curta duracao */}
            <img src={media.viewUrl} alt="" className="size-20 rounded-lg border border-border object-cover" />
            <form action={removePostMediaAction}>
              <input type="hidden" name="id" value={postId} />
              <input type="hidden" name="mediaId" value={media.id} />
              <button
                type="submit"
                aria-label="Remover foto"
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground"
              >
                ×
              </button>
            </form>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={existingMedia.length >= MAX_PHOTOS}
        onClick={() => fileInputRef.current?.click()}
        className="self-start"
      >
        Enviar fotos
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        onChange={handleFileChange}
        className="sr-only"
      />

      {queue.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {queue.map((item, idx) => (
            <li key={idx}>
              {item.name} —{" "}
              {item.status === "error" ? <span className="text-destructive">erro no envio</span> : `${item.progress}%`}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
