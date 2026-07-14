import { useSyncExternalStore } from "react";

// Deteccao de plataforma (INC-012) — so' faz sentido no cliente (UA/matchMedia
// nao existem no servidor). Usado pelo banner de instalacao e pelo opt-in de
// push: no iOS, push exige o PWA ja instalado (ADR-002); nao ha' evento
// `beforeinstallprompt` no Safari, entao a instrucao la' e' sempre manual.

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as { standalone?: boolean }).standalone;
  return iosStandalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

const noSubscription = () => () => {};
const alwaysFalse = () => false;

/**
 * Bug real de campo (QA em iPhone, INC-012): chamar isIos()/isStandalone()
 * direto no corpo do componente parecia seguro (guardas para
 * `typeof navigator/window === "undefined"`), mas o Node do runtime do
 * Next.js expõe um `navigator` global proprio desde a v21 (`navigator.
 * userAgent` tipo "Node.js/24", que nunca bate no regex de iOS) — o SSR
 * sempre calcula "nao e' iOS" e embute esse branch no HTML inicial. No
 * iPhone real esse mismatch de hidratacao (servidor disse botao, cliente
 * calcularia instrucao) nao se corrigia de forma confiavel: o botao "Ativar
 * notificacoes" ficava visivel no Safari sem o PWA instalado, mesmo sem
 * chance de o push funcionar (ADR-002). `useSyncExternalStore` com
 * subscribe no-op resolve na raiz: o servidor sempre usa o snapshot
 * `false` (nunca finge saber a plataforma real), e o cliente atualiza para
 * o valor verdadeiro logo depois da hidratacao, sem mismatch.
 */
export function useIosNonStandalone(): boolean {
  return useSyncExternalStore(noSubscription, () => isIos() && !isStandalone(), alwaysFalse);
}

export function useIsStandalone(): boolean {
  return useSyncExternalStore(noSubscription, isStandalone, alwaysFalse);
}
