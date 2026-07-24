"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { kindForContentType, maxBytesForContentType } from "@/lib/storage/media-constraints";
import {
  confirmBrandingUploadAction,
  requestBrandingUploadUrl,
  type BrandingTarget,
} from "./actions";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";

/** Upload de uma imagem de branding (banner ou logo, INC-017). Reusa o fluxo do
 * INC-016: pede a URL assinada, envia DIRETO ao storage (PUT presigned) e
 * confirma (o servidor valida o tipo REAL por magic number). O banner/logo
 * atual so' e' trocado no confirm aprovado — um envio invalido nao apaga o
 * que ja' estava configurado. */
export function AppearanceUploader({
  target,
  currentUrl,
  previewClassName,
  buttonLabel,
}: {
  target: BrandingTarget;
  currentUrl: string | null;
  previewClassName: string;
  buttonLabel: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validacao antecipada (feedback rapido) — a autoridade e' o confirm.
    if (kindForContentType(file.type) !== "image") {
      setError("Envie uma imagem (JPG, PNG ou WEBP).");
      event.target.value = "";
      return;
    }
    const limit = maxBytesForContentType(file.type);
    if (limit !== null && file.size > limit) {
      setError("Imagem acima do limite de 5 MB.");
      event.target.value = "";
      return;
    }

    setPending(true);
    setError(null);
    try {
      const { uploadUrl, key } = await requestBrandingUploadUrl(target);
      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("upload falhou");

      const confirmed = await confirmBrandingUploadAction(target, key);
      if (!confirmed.ok) {
        setError(confirmed.error);
        return;
      }
      router.refresh();
    } catch {
      setError("Não foi possível enviar a imagem. Tente um arquivo JPG, PNG ou WEBP de até 5 MB.");
    } finally {
      setPending(false);
      event.target.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada, curta duracao; nao cacheavel pelo otimizador do Next.
        <img src={currentUrl} alt="" className={previewClassName} />
      ) : (
        <div
          className={`flex items-center justify-center bg-muted text-meta text-muted-foreground ${previewClassName}`}
        >
          Sem imagem — usando a arte padrão
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="touch"
        disabled={pending}
        onClick={() => fileInputRef.current?.click()}
        className="self-start"
      >
        {pending ? "Enviando…" : buttonLabel}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFileChange}
        disabled={pending}
        className="sr-only"
      />

      {error && <p role="alert" className="text-meta text-destructive">{error}</p>}
    </div>
  );
}
