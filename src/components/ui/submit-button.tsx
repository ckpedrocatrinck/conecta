"use client"

import { useFormStatus } from "react-dom"
import { Button, buttonVariants } from "@/components/ui/button"
import type { VariantProps } from "class-variance-authority"

interface SubmitButtonProps
  extends React.ComponentProps<typeof Button>,
    VariantProps<typeof buttonVariants> {
  pendingLabel?: string
}

/** Botao de submit generico com estado pending via `useFormStatus` (mesmo
 * padrao do AckSubmitButton, ver comunicados/[id]/ack-submit-button.tsx) —
 * usado nas acoes de broadcast do admin (R16, auditoria 2026-07) pra evitar
 * duplo-submit em rede lenta. Precisa estar dentro de um <form>. */
function SubmitButton({ children, pendingLabel, disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending ? pendingLabel ?? "Enviando…" : children}
    </Button>
  )
}

export { SubmitButton }
