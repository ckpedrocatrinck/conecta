"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getAvatarColors, getInitial } from "@/lib/cards/avatar";
import { confirmPhotoUploadAction, requestPhotoUploadUrl } from "./actions";

/** Herói do perfil (INC-013.5): avatar grande (foto com recorte central ou
 * iniciais sobre cor determinística — mesma paleta do Avatar/card), a
 * identidade (children, vinda do servidor) e o botão "Trocar foto". `photoUrl`
 * já chega filtrado por consentimento a montante. */
export function PhotoUploader({
  currentPhotoUrl,
  name,
  children,
}: {
  currentPhotoUrl: string | null;
  name: string;
  children?: ReactNode;
}) {
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

  const colors = getAvatarColors(name);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {currentPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada, curta duracao; nao cacheavel pelo otimizador de imagem do Next.
        <img
          src={currentPhotoUrl}
          alt="Foto de perfil"
          className="size-24 rounded-full object-cover object-center"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-24 items-center justify-center rounded-full border-[1.5px] border-primary-deep/15 text-2xl font-extrabold"
          style={{ backgroundColor: colors.bg, color: colors.fg }}
        >
          {getInitial(name)}
        </span>
      )}

      {children}

      <Button
        type="button"
        variant="outline"
        size="touch"
        disabled={pending}
        onClick={() => fileInputRef.current?.click()}
      >
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
      {error && <p className="text-meta text-destructive">{error}</p>}
    </div>
  );
}
