"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
function getSnapshot() {
  return !navigator.onLine;
}
function getServerSnapshot() {
  return false;
}

/**
 * Banner "sem conexao" honesto (INC-012, escopo item 2): so' aparece
 * enquanto `navigator.onLine` for false, sem botao de fechar (mesmo padrao
 * do banner de pendencia do design-system — persiste enquanto a condicao
 * existir). Neutro (nao usa --action: nao e' uma acao do usuario).
 * `useSyncExternalStore` em vez de efeito+setState: snapshot do servidor e'
 * sempre "online", sem risco de mismatch de hidratacao.
 */
export function OfflineBanner() {
  const isOffline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!isOffline) return null;

  return (
    <div className="flex items-center gap-2 bg-muted px-4 py-2 text-sm text-foreground" role="status">
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      Sem conexão — mostrando a última versão salva.
    </div>
  );
}
