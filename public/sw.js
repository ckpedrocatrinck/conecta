// Service worker do PWA (INC-012). Escrito a mao (sem next-pwa/workbox — o
// projeto nao tem passo de build de SW, ver stack.md). Estrategia (reduzida
// apos regressao real de QA — ver commit de correcao):
//
// - Navegacao (documentos HTML): network-first. Online, sempre busca a rede
//   e guarda a resposta no cache; offline, serve a ultima copia cacheada da
//   MESMA url; se essa url nunca foi visitada, cai no fallback /offline.
//   Isso cumpre "leitura offline das ultimas telas visitadas" sem fingir
//   ter dado que nunca foi baixado (design-system.md: erro/estado honesto).
// - So' isso. Scripts/estilos/imagens NAO passam pelo service worker — o
//   Next.js ja serve `_next/static/*` com Cache-Control immutable de longa
//   duracao; a versao anterior deste arquivo interceptava
//   destination=script/style/image tambem (cache-first), e essa era a UNICA
//   parte do SW que tocava justamente os recursos cuja corrupcao quebra a
//   hidratacao/interatividade — suspeito nº 1 da regressao "varios botoes
//   pararam de responder no modo standalone" (QA em iPhone real). Removido:
//   nao ha' ganho real (o cache HTTP do browser ja cobre esses arquivos
//   imutaveis) e era o unico risco alto do arquivo.
// - Nunca intercepta metodo != GET nem origem cruzada (mutacoes/Server
//   Actions passam direto pela rede, como deveriam).

// Nome do cache versionado: qualquer instalacao anterior do SW (inclusive a
// que tinha a cache de scripts suspeita) e' descartada na ativacao, porque
// o passo abaixo apaga toda cache com nome != o atual.
const SHELL_CACHE = "conecta-shell-v2";
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
  // O fetch tem que comecar JA, sem esperar nada de Cache Storage antes —
  // regressao real de QA (lentidao geral, desktop e mobile): a versao
  // anterior fazia `await caches.open(...)` ANTES do fetch, serializando a
  // abertura do banco de cache na frente de toda navegacao. Abrir/gravar
  // cache so' acontece depois, fora do caminho critico da resposta.
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected) {
      caches
        .open(SHELL_CACHE)
        .then((cache) => cache.put(request, response.clone()))
        .catch(() => {});
    }
    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(request);
    return cached ?? cache.match(OFFLINE_URL);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;
  if (request.mode !== "navigate") return;

  event.respondWith(handleNavigation(request));
});
