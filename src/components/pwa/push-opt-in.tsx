"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTimeSaoPaulo } from "@/lib/dates/format-datetime";
import { useIosNonStandalone } from "@/lib/pwa/platform";
import { urlBase64ToUint8Array } from "@/lib/pwa/vapid-key";
import { revokeOwnPushSubscriptionAction, saveOwnPushSubscriptionAction } from "@/app/(app)/perfil/push-actions";

type PushSubscriptionRow = { id: string; createdAt: Date };

type Status = "idle" | "pending" | "denied" | "unsupported" | "error";

/**
 * Opt-in de push (INC-012, escopo item 3). No iOS, so' funciona com o PWA
 * ja instalado na tela inicial (ADR-002) — nunca deixa tentar `subscribe()`
 * numa aba do Safari, que falharia silenciosamente; mostra a instrucao de
 * instalar primeiro. Mensagem de permissao negada sempre em pt-BR (nunca o
 * texto em ingles do navegador — anti-padrao portal legado do design-system).
 */
export function PushOptIn({ subscriptions }: { subscriptions: PushSubscriptionRow[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const iosNonStandalone = useIosNonStandalone();

  if (iosNonStandalone) {
    return (
      <p className="text-sm text-muted-foreground">
        Para receber notificações no iPhone, primeiro instale o Conecta na tela inicial (toque em{" "}
        <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>) e abra o app pelo ícone.
      </p>
    );
  }

  async function activate() {
    setStatus("pending");

    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "denied") {
      setStatus("denied");
      return;
    }
    if (permission !== "granted") {
      setStatus("idle");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const keys = subscription.toJSON().keys as { p256dh: string; auth: string };

      await saveOwnPushSubscriptionAction({ endpoint: subscription.endpoint, keys });
      router.refresh();
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  async function revoke(id: string) {
    await revokeOwnPushSubscriptionAction(id);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" size="sm" className="self-start" disabled={status === "pending"} onClick={activate}>
        <Bell className="size-4" aria-hidden="true" />
        Ativar notificações neste dispositivo
      </Button>

      {status === "denied" && (
        <p role="alert" className="text-sm text-destructive">
          Você negou as notificações. Para ativar depois, permita nas configurações do navegador.
        </p>
      )}
      {status === "unsupported" && (
        <p className="text-sm text-muted-foreground">Este navegador não tem suporte a notificações push.</p>
      )}
      {status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível ativar as notificações agora. Tente novamente.
        </p>
      )}

      {subscriptions.length > 0 && (
        <ul className="flex flex-col gap-2">
          {subscriptions.map((subscription) => (
            <li
              key={subscription.id}
              className="flex items-center justify-between rounded-lg border border-border p-2.5 text-sm"
            >
              <span className="text-muted-foreground">
                Dispositivo cadastrado em {formatDateTimeSaoPaulo(subscription.createdAt)}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => revoke(subscription.id)}>
                <BellOff className="size-4" aria-hidden="true" />
                Revogar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
