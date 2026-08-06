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

// ---------------------------------------------------------------------------
// Push (INC-026). Esta metade NUNCA existiu: o INC-012 entregou VAPID, canal e
// opt-in, e o evento `push` chegava aqui sem nenhum listener — a Apple aceitava
// a mensagem (201 + apns-id) e o device nao exibia nada.
//
// A inscricao e' criada com `userVisibleOnly: true`, que e' um COMPROMISSO:
// todo push recebido tem que virar notificacao visivel. Por isso nenhum caminho
// abaixo pode terminar sem `showNotification` — nem payload corrompido, nem
// JSON invalido, nem campo faltando. Descumprir isso faz o navegador punir a
// origem e, no Safari, pode revogar a inscricao sozinho.
// ---------------------------------------------------------------------------

// Reusa os icones que ja servem o manifest (rotas do App Router, verificadas
// respondendo 200). O iOS ignora `icon`/`badge` e usa o icone do app instalado;
// Android/desktop usam os dois.
const NOTIFICATION_ICON = "/icon-192.png";
const NOTIFICATION_BADGE = "/icon-192.png";
const FALLBACK_TITLE = "Conecta";
const FALLBACK_BODY = "Você tem uma novidade no Conecta.";

function readPushPayload(data) {
  if (!data) return {};
  try {
    const parsed = data.json();
    // `JSON.parse("null")`/`"texto"`/`123` sao JSON validos e nao sao objeto —
    // acessar `.title` em null lancaria e mataria o showNotification.
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    // Corpo nao-JSON. Segue com o fallback generico, NUNCA sem notificacao.
    return {};
  }
}

function pickString(value, fallback) {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

/** So' aceita caminho relativo da propria origem: uma `url` absoluta vinda do
 * payload abriria destino externo a partir de uma notificacao nossa. */
function pickInternalPath(value) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event.data);
  event.waitUntil(
    self.registration.showNotification(pickString(payload.title, FALLBACK_TITLE), {
      body: pickString(payload.body, FALLBACK_BODY),
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_BADGE,
      data: { url: pickInternalPath(payload.url) },
    }),
  );
});

/** Foca a janela ja aberta (e navega ate' o destino) em vez de abrir uma
 * segunda; so' abre janela nova se nao houver nenhuma. */
async function openOrFocus(path) {
  const target = new URL(path, self.location.origin);

  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    if (new URL(client.url).origin !== target.origin) continue;
    if (typeof client.focus !== "function") continue;

    const focused = await client.focus();
    if (focused.url === target.href) return;
    if (typeof focused.navigate === "function") {
      try {
        await focused.navigate(target.href);
        return;
      } catch {
        // `navigate` nao vale para client nao controlado (e nem sempre existe
        // no Safari): cai para openWindow abaixo, melhor que nao ir a lugar
        // nenhum.
      }
    }
    break;
  }

  if (typeof self.clients.openWindow === "function") {
    await self.clients.openWindow(target.href);
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = pickInternalPath(event.notification.data && event.notification.data.url);
  event.waitUntil(openOrFocus(path));
});
