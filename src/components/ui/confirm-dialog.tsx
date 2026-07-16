"use client"

import { AlertDialog } from "@base-ui/react/alert-dialog"
import type { VariantProps } from "class-variance-authority"
import { buttonVariants } from "@/components/ui/button"
import { SubmitButton } from "@/components/ui/submit-button"
import { cn } from "@/lib/utils"

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"]
type ButtonSize = VariantProps<typeof buttonVariants>["size"]

interface ConfirmDialogProps {
  triggerLabel: string
  /** Nome acessivel do trigger, quando triggerLabel e' so' um simbolo (ex.
   * "×") e nao serve como nome lido por leitor de tela. */
  triggerAriaLabel?: string
  triggerVariant?: ButtonVariant
  triggerSize?: ButtonSize
  triggerClassName?: string
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  /** Laranja/`action` por padrao; destructive para acoes irreversiveis
   * (arquivar, desligar, remover) — vermelho, nunca `--action` decorativo. */
  destructive?: boolean
  action: (formData: FormData) => void | Promise<void>
  hiddenFields?: Record<string, string>
}

/** Confirmacao destrutiva reusavel (R14, auditoria 2026-07) — nao um
 * `confirm()` nativo do browser. O botao de confirmar e' um submit de
 * verdade dentro de um `<form action={action}>`: a Server Action so' roda
 * se o usuario confirmar no dialog, sem JS de submit manual. */
function ConfirmDialog({
  triggerLabel,
  triggerAriaLabel,
  triggerVariant = "destructive",
  triggerSize = "sm",
  triggerClassName,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  destructive = true,
  action,
  hiddenFields,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger
        aria-label={triggerAriaLabel}
        className={cn(buttonVariants({ variant: triggerVariant, size: triggerSize }), triggerClassName)}
      >
        {triggerLabel}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-foreground/40" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <AlertDialog.Title className="text-base font-bold text-foreground">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-1.5 text-sm text-muted-foreground">
            {description}
          </AlertDialog.Description>
          <form action={action} className="mt-4 flex justify-end gap-2">
            {hiddenFields &&
              Object.entries(hiddenFields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
            <AlertDialog.Close type="button" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {cancelLabel}
            </AlertDialog.Close>
            <SubmitButton variant={destructive ? "destructive" : "action"} size="sm" pendingLabel="Processando…">
              {confirmLabel}
            </SubmitButton>
          </form>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

export { ConfirmDialog }
