"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Botao mais importante do app (design-system): laranja, largura total,
 * alvo grande. `useFormStatus` desabilita durante o submit — proteção de UX
 * contra duplo-toque; a garantia real de nao duplicar e' a constraint do
 * banco (`createAnnouncementAckIdempotent`). */
export function AckSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="action" size="xl" disabled={pending} className="w-full">
      {pending ? "Confirmando..." : "Declaro ciência"}
    </Button>
  );
}
