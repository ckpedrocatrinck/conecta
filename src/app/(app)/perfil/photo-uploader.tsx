"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { confirmPhotoUploadAction, requestPhotoUploadUrl } from "./actions";

export function PhotoUploader({ currentPhotoUrl }: { currentPhotoUrl: string | null }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPending(true);
    setError(null);
    try {
      const { uploadUrl, key } = await requestPhotoUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("upload falhou");

      await confirmPhotoUploadAction(key);
      router.refresh();
    } catch {
      setError("Não foi possível enviar a foto. Tente um arquivo JPG, PNG ou WebP de até 5MB.");
    } finally {
      setPending(false);
      event.target.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      {currentPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada, curta duracao; nao cacheavel pelo otimizador de imagem do Next.
        <img src={currentPhotoUrl} alt="Foto de perfil" className="size-16 rounded-full object-cover" />
      ) : (
        <div className="flex size-16 items-center justify-center rounded-full bg-zinc-200 text-xs text-zinc-500 dark:bg-zinc-800">
          Sem foto
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Button type="button" variant="outline" size="touch" disabled={pending} onClick={() => fileInputRef.current?.click()}>
          {pending ? "Enviando..." : "Trocar foto"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={pending}
          className="sr-only"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
