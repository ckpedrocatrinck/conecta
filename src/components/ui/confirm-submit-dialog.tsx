"use client"

import { AlertDialog } from "@base-ui/react/alert-dialog"
import type { VariantProps } from "class-variance-authority"
import { buttonVariants } from "@/components/ui/button"
import { SubmitButton } from "@/components/ui/submit-button"
import { cn } from "@/lib/utils"

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"]
type ButtonSize = VariantProps<typeof buttonVariants>["size"]

interface ConfirmSubmitDialogProps {
  triggerLabel: string
  triggerVariant?: ButtonVariant
  triggerSize?: ButtonSize
  triggerDisabled?: boolean
  title: string
  /** Consequencias do ato, em texto corrido ou lista — o que o dialogo existe
   * para declarar antes de efetivar. */
  children: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  pendingLabel?: string
  confirmVariant?: ButtonVariant
  /** `id` do <form> que sera' submetido. */
  formId: string
  /** Server Action que recebe o formulario ao confirmar. */
  formAction: (formData: FormData) => void | Promise<void>
  /** Elemento DENTRO do <form> onde o popup e' portalizado — ver comentario
   * do componente. */
  container?: React.RefObject<HTMLElement | null>
}

/**
 * Irma do `ConfirmDialog`, para o caso em que a confirmacao nao carrega um
 * punhado de campos escondidos e sim **o formulario da tela inteiro** (INC-018
 * item 6: publicar/agendar direto da tela de criacao passa por uma trava
 * deliberada que enuncia as consequencias).
 *
 * Por que nao reusar o `ConfirmDialog`: la' o botao de confirmar vive num
 * `<form>` proprio com `hiddenFields`, o que nao alcanca titulo/corpo/
 * categoria/publico-alvo do formulario da pagina.
 *
 * Como funciona: o `AlertDialog.Popup` do Base UI e' obrigatoriamente
 * portalizado (`Dialog.Portal` e' exigido pelo componente), o que por padrao
 * jogaria o botao de confirmar para fora da arvore DOM do formulario. Duas
 * amarracoes nativas, independentes, garantem o submit — nenhuma delas e'
 * submit sintetico via JS:
 *
 * 1. `container` — o popup e' portalizado para um elemento DENTRO do proprio
 *    `<form>`, entao o botao e' descendente do form e submete como qualquer
 *    outro submit. E' o caminho principal.
 * 2. `form={formId}` — associacao de formulario do HTML pelo atributo `form`,
 *    que funciona mesmo se o popup terminar em `<body>` (container ausente ou
 *    ainda nao montado). Rede de seguranca.
 *
 * Em ambos os casos o clique dispara um submit de verdade tendo este botao
 * como `event.submitter`; o React le' o `formAction` do submitter e chama a
 * Server Action com o FormData completo do formulario. O `useFormStatus` do
 * SubmitButton continua valendo porque o Portal muda o lugar no DOM, nao na
 * arvore React.
 */
function ConfirmSubmitDialog({
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "touch",
  triggerDisabled,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancelar",
  pendingLabel = "Processando…",
  confirmVariant = "action",
  formId,
  formAction,
  container,
}: ConfirmSubmitDialogProps) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger
        type="button"
        disabled={triggerDisabled}
        className={cn(buttonVariants({ variant: triggerVariant, size: triggerSize }))}
      >
        {triggerLabel}
      </AlertDialog.Trigger>
      <AlertDialog.Portal container={container}>
        <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-foreground/40" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <AlertDialog.Title className="text-base font-bold text-foreground">{title}</AlertDialog.Title>
          <AlertDialog.Description
            render={<div />}
            className="mt-1.5 flex flex-col gap-1.5 text-sm text-muted-foreground"
          >
            {children}
          </AlertDialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <AlertDialog.Close type="button" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {cancelLabel}
            </AlertDialog.Close>
            <SubmitButton
              form={formId}
              formAction={formAction}
              variant={confirmVariant}
              size="sm"
              pendingLabel={pendingLabel}
            >
              {confirmLabel}
            </SubmitButton>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

export { ConfirmSubmitDialog }
