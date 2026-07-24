"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { updateAccentColorAction } from "./actions";

/** Cor de destaque — salva NO ATO ao escolher (sem botao), mesmo padrao do
 * banner/logo ("muda => salva => confirma"). O evento `change` do input de cor
 * dispara na confirmacao da escolha (fechar o seletor), nao a cada pixel do
 * arraste, entao e' um save por commit. */
export function AccentColorField({ initialColor }: { initialColor: string }) {
  const router = useRouter();
  const [color, setColor] = useState(initialColor);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setColor(value);
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await updateAccentColorAction(value);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Cor atualizada.");
      router.refresh();
    } catch {
      setError("Erro no servidor ao salvar a cor. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="accentColor">Cor</Label>
      <div className="flex items-center gap-3">
        <input
          id="accentColor"
          name="accentColor"
          type="color"
          value={color}
          disabled={pending}
          onChange={handleChange}
          className="h-11 w-20 cursor-pointer rounded-md border border-border bg-card p-1 disabled:opacity-60"
        />
        <span className="font-mono text-meta text-muted-foreground">{color}</span>
      </div>
      {error && <p role="alert" className="text-meta text-destructive">{error}</p>}
      {success && <p role="status" className="text-meta font-medium text-success">{success}</p>}
    </div>
  );
}
