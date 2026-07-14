// Service worker do PWA (INC-012). Escrito a mao (sem next-pwa/workbox — o
// projeto nao tem passo de build de SW, ver stack.md). Estrategia:
//
// - Navegacao (documentos HTML): network-first. Online, sempre busca a rede
//   e guarda a resposta no cache; offline, serve a ultima copia cacheada da
//   MESMA url; se essa url nunca foi visitada, cai no fallback /offline.
//   Isso cumpre "leitura offline das ultimas telas visitadas" sem fingir
//   ter dado que nunca foi baixado (design-system.md: erro/estado honesto).
// - Estaticos same-origin GET (JS/CSS/imagens/_next/static): cache-first com
//   atualizacao em segundo plano (stale-while-revalidate) — sao imutaveis
//   por hash de build, cache agressivo e' seguro.
// - Nunca intercepta metodo != GET nem origem cruzada (mutacoes/Server
//   Actions passam direto pela rede, como deveriam).

const SHELL_CACHE = "conecta-shell-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/manifest.webmanifest"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached ?? cache.match(OFFLINE_URL);
  }
}

async function handleStatic(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached ?? (await network) ?? Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (request.destination === "script" || request.destination === "style" || request.destination === "image") {
    event.respondWith(handleStatic(request));
  }
});
