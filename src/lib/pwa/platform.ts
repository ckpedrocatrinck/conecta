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
