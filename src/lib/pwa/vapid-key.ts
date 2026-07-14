// pushManager.subscribe espera a chave publica VAPID como Uint8Array, nao a
// string base64url que a env var carrega — conversao padrao da spec Web Push.
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from({ length: rawData.length }, (_, i) => rawData.charCodeAt(i));
}
