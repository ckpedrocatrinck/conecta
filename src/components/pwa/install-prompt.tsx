"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isIos, isStandalone } from "@/lib/pwa/platform";

const DISMISSED_KEY = "conecta:install-prompt-dismissed-at";
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

function wasDismissedRecently(): boolean {
  const raw = localStorage.getItem(DISMISSED_KEY);
  if (!raw) return false;
  return Date.now() - Number(raw) < DISMISS_COOLDOWN_MS;
}

const noSubscription = () => () => {};
const alwaysFalse = () => false;

/**
 * Leituras hydration-safe de APIs so' do navegador (UA, display-mode,
 * localStorage) — nenhuma muda depois do mount nesta tela, entao
 * `useSyncExternalStore` com subscribe no-op: sem efeito, sem `setState`
 * sincrono a sincronizar, sem risco de mismatch SSR x cliente (o servidor
 * usa sempre o snapshot `false`; o cliente atualiza para o valor real so'
 * depois da hidratacao, sem warning).
 */
function useIosNonStandalone(): boolean {
  return useSyncExternalStore(noSubscription, () => isIos() && !isStandalone(), alwaysFalse);
}
function useIsStandalone(): boolean {
  return useSyncExternalStore(noSubscription, isStandalone, alwaysFalse);
}
function useWasDismissedRecently(): boolean {
  return useSyncExternalStore(noSubscription, wasDismissedRecently, alwaysFalse);
}

/**
 * Banner de instalacao nao intrusivo (INC-012, escopo item 1): so' aparece
 * depois que o colaborador ja navegou dentro do app pelo menos uma vez nesta
 * sessao (proxy simples de "primeiro uso bem-sucedido" — heuristica de UI,
 * ajustavel depois, ver plano do INC-012). O ajuste de `hasNavigated` a
 * partir da mudanca de `pathname` acontece durante o render (padrao "adjust
 * state when a prop changes" dos docs do React), nao num efeito.
 *
 * Android/Chrome: captura `beforeinstallprompt` e oferece o prompt nativo.
 * iOS Safari: nao existe esse evento — instrucao manual (Compartilhar >
 * Adicionar a Tela de Inicio), unica forma de instalar no iOS (ADR-002).
 */
export function InstallPrompt() {
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const standalone = useIsStandalone();
  const iosNonStandalone = useIosNonStandalone();
  const dismissedRecently = useWasDismissedRecently();

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (!hasNavigated) setHasNavigated(true);
  }

  useEffect(() => {
    if (standalone || iosNonStandalone || dismissedRecently) return;

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, [standalone, iosNonStandalone, dismissedRecently]);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setDismissed(true);
    setDeferredEvent(null);
  }

  async function install() {
    await deferredEvent?.prompt();
    dismiss();
  }

  if (standalone || dismissed || dismissedRecently || !hasNavigated) return null;
  if (!iosNonStandalone && !deferredEvent) return null;

  return (
    <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
      <Download className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="flex-1 text-sm text-foreground">
        {iosNonStandalone ? (
          <>
            Instale o Conecta na tela inicial: toque em <strong>Compartilhar</strong> e depois em{" "}
            <strong>Adicionar à Tela de Início</strong>.
          </>
        ) : (
          "Instale o Conecta na tela inicial para acesso rápido e notificações."
        )}
      </div>
      {!iosNonStandalone && (
        <Button size="sm" onClick={install} className="shrink-0">
          Instalar
        </Button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar"
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
