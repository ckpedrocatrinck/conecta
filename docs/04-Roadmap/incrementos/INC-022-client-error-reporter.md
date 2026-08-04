# INC-022 — Client-error reporter para depuração mobile

**Status:** 🟡 Código concluído (2026-08-04) — aguarda o critério 6 (reprodução no iPhone), que só o Pedro pode executar
**Fase:** transversal (ferramenta de diagnóstico, não feature de produto)
**Depende de:** nenhum INC anterior — é isolado, toca só instrumentação
**Branch:** `inc-022-client-error-reporter`
**Origem:** falhas reportadas em iPhone real (aplaudir, foto, candidatura, push) que persistiram após limpeza de SW/cache e reteste. Sem Mac disponível para Safari Web Inspector, não há visibilidade de erro client-side no device.

## Objetivo

Capturar erros JS não tratados, promise rejections não tratadas, e falhas de route error boundary no client, e enviá-los a um endpoint server-side para leitura em log — SEM depender de inspector conectado.

## Princípio de escopo

É instrumentação temporária de depuração, não observability permanente. Não substitui os fixes já feitos (R8/R10/R13/foto do INC-012.5) — serve para achar o que ainda não foi visto/diagnosticado. Não é Sentry nem equivalente; se a necessidade de observability permanente ficar clara depois do piloto, isso vira uma DP separada.

## Contexto (mapa read-only confirmado 2026-08-04)

Confirmado no código antes de escrever o escopo, para o executor não precisar decidir nada em tempo de execução:

| Ponto | Estado real |
|---|---|
| Layout onde montar | **`src/app/layout.tsx`** — continua sendo o layout raiz depois do INC-014; `[slug]/layout.tsx` existe mas é o boundary de tenant. O raiz já monta um client component de PWA (`<ServiceWorkerRegister />`, linha 37) — mesmo lugar, mesmo padrão. Montar no raiz cobre inclusive a tela de login (pré-sessão), que é parte do requisito. |
| Error boundary de rota | **Existe**: `src/app/error.tsx` (Q1 da auditoria de usabilidade). É Client Component e recebe `{ error, reset }`, mas hoje **só desestrutura `reset`** — o hook do item 4 precisa passar a usar `error` (e `error.digest`). Portanto o item 4 **não é pulado**. |
| Rate limiter | **Existe e é exportável**: `src/lib/security/rate-limit.ts` (INC-013 Bloco B / G5) — `isRateLimited(key, {limit, windowMs})` + `recordAttempt(...)`, fixed-window em memória, JS puro edge-safe. **Reusar**, não escrever limiter novo. |
| Middleware x `/api/debug/**` | **Já passa sem sessão, sem mudar nada.** `extractTenantSlug` devolve `null` para primeiro segmento reservado (`api`), e o middleware faz `forward()` nesse caso (`middleware.ts:48`) — a rota não é redirecionada para login. **Não** adicionar `/api/debug/client-error` a `PUBLIC_PATHS`: seria ruído, o caminho já é livre (mesmo motivo pelo qual `/api/media/**` funciona sem estar na lista). |

## Escopo

### 1. Endpoint `POST /api/debug/client-error`

- Sem autenticação obrigatória (erro pode ocorrer pré-login, ex. tela de login).
- Schema de entrada fixo e validado (rejeitar campos fora disso):

```ts
{
  message: string;       // max 500 chars
  stack?: string;        // max 4000 chars
  type: 'error' | 'unhandledrejection' | 'console_error' | 'boundary';
  route: string;         // pathname, não query string completa
  userAgent: string;
  tenantSlug?: string;
  timestamp: string;     // ISO
}
```

- Payload total > 8KB → **413**, sem logar.
- Rate limit básico por IP: reusar `src/lib/security/rate-limit.ts` com chave própria deste endpoint (ex. `debug-client-error:<ip>`), ex. 20 req/min. Não precisa ser a mesma janela do resto da app.
- NUNCA aceitar ou logar campos livres além do schema acima. Nunca logar corpo de request de outras rotas, cookie, header de auth, ou querystring completa (pode conter token).
- Log: uma linha JSON em stdout prefixada `[CLIENT_ERROR]`, capturável via `docker compose logs app | grep CLIENT_ERROR`. **Sem escrita em banco.**

### 2. Módulo client `src/lib/debug/client-error-reporter.ts`

- Só ativa se `localStorage.getItem('conecta_debug') === '1'`. Se a flag não estiver setada, a função de setup retorna imediatamente e NENHUM listener é registrado (custo zero para usuário real).
- `window.addEventListener('error', handler)` — erro JS não tratado.
- `window.addEventListener('unhandledrejection', handler)` — promise rejeitada.
- Wrap de `console.error`: encaminha também, com guarda anti-recursão (o próprio fetch de envio nunca deve re-disparar o wrap) e dedupe simples (mesma `message` dentro de uma janela de 2s não reenvia).
- Envio via `fetch('/api/debug/client-error', { method: 'POST', keepalive: true, ... })` — `keepalive` garante envio mesmo se a página estiver navegando/fechando.
- Nunca captura `event.target` de formulário, nunca lê `document.forms`, nunca inclui querystring da rota (só pathname).

### 3. Montagem

- Componente client (`<ClientErrorReporter />`) importado dinamicamente (`next/dynamic`, sem SSR) em **`src/app/layout.tsx`**, ao lado de `<ServiceWorkerRegister />` (ver mapa acima).
- Checa a flag e só então registra os listeners; se desativado, o componente não renderiza nada e não importa o módulo pesado.

### 4. Hook no error boundary de rota

- `src/app/error.tsx` existe (Q1/INC-012.5): adicionar uma chamada ao reporter com `type: 'boundary'` quando a flag estiver ativa, usando o `error` que o boundary já recebe mas hoje ignora. A mensagem exibida ao usuário **não muda** (continua sem vazar detalhe técnico — só o log server-side recebe o `message`/`stack`).

### 5. Ativação no device (documentar no Relatório de Entrega)

- Rota de conveniência: acessar `?debug=1` seta `localStorage.setItem('conecta_debug','1')` e recarrega sem o parâmetro na URL (evita persistir `?debug=1` em bookmarks/PWA shortcut). É a forma prática de ativar em iPhone sem devtools.

## Fora de escopo

- Qualquer observability permanente (Sentry, etc.) — fica para DP futura.
- Persistência em banco dos erros capturados.
- Qualquer alteração nos handlers de aplaudir/foto/candidatura/push em si — este INC só instrumenta, não corrige.
- Mexer em `PUBLIC_PATHS`/matcher do middleware (desnecessário, ver mapa).

## Critérios de aceite

- [x] Flag desativada (padrão): nenhum listener registrado, nenhum import do módulo pesado, sem overhead perceptível. — verificado no bundle de produção: o chunk sempre carregado (1,1 KB: flag + montagem) **não contém** a string `/api/debug/client-error`; o módulo pesado vive num chunk separado (1,9 KB) só buscado quando a flag está ligada.
- [x] Flag ativada + erro JS proposital → aparece no log do servidor em segundos, com todos os campos do schema. — endpoint provado ponta a ponta contra `next start` (204 + linha `[CLIENT_ERROR]` no stdout). O disparo pelo browser real é o critério 6.
- [x] Flag ativada + promise rejeitada não tratada → idem. — `handleRejection` cobre `unhandledrejection`; o tipo é aceito e logado pelo endpoint (teste + smoke).
- [x] Payload nunca contém senha, CPF, corpo de formulário ou querystring completa — só os campos do schema. — schema fixo com rejeição de chave desconhecida (400) e `stripQuery` no servidor; provado por teste e por smoke (`?token=SEGREDO` não chega ao log).
- [x] Endpoint rejeita payload > 8KB e aplica rate limit. — 413 verificado com corpo de 9 KB; 429 na 21ª request do mesmo IP em 1 min, sem afetar outro IP.
- [ ] Reprodução real no iPhone (aplaudir/foto/candidatura/push) com a flag ativa: OU aparece erro correspondente no log, OU se nenhum erro client aparecer, isso é registrado explicitamente no Relatório de Entrega como evidência de que a falha é server-side/rede, não client JS — redirecionando a investigação para logs de servidor/rate limit em vez de mais código client. — **pendente: depende do device do Pedro.** Passo a passo no Relatório de Entrega.
- [x] `npm run lint && npm run typecheck && npm run test && npm run build` verdes.

## Reconciliação de vault (parte da entrega)

- Preencher o Registro de conclusão deste arquivo.
- `docs/04-Roadmap/roadmap.md`: marcar INC-022 ✅.
- Se o item 6 dos critérios apontar causa server-side, registrar o achado (não o conserto) para virar INC/DP própria — este INC não corrige nada.

## Registro de conclusão

- **Código concluído em:** 2026-08-04
- **Branch:** `inc-022-client-error-reporter` (criada da `main` depois de mergear o
  INC-021, que estava concluído mas não mergeado — `d51681d`)

### Arquivos

| Arquivo | Papel |
|---|---|
| `src/lib/debug/client-error-contract.ts` (novo) | Schema fixo, limites e o prefixo `[CLIENT_ERROR]`. Compartilhado cliente/servidor — o servidor revalida tudo mesmo assim. |
| `src/lib/debug/debug-flag.ts` (novo) | Única porta de ativação (`conecta_debug` no localStorage) + `?debug=1`/`?debug=0`. Minúsculo e sem dependência: é o que sempre entra no bundle. |
| `src/lib/debug/client-error-reporter.ts` (novo) | Módulo pesado: listeners `error`/`unhandledrejection`, wrap de `console.error`, dedupe de 2s, envio com `keepalive`. Carregado sob demanda. |
| `src/components/debug/client-error-reporter.tsx` (novo) | Montagem sem UI: lê a flag e só então faz o `import()` do módulo pesado. |
| `src/app/api/debug/client-error/route.ts` (novo) | Coletor: rate limit → teto de 8 KB → schema fixo → uma linha JSON em stdout. |
| `src/app/api/debug/client-error/route.test.ts` (novo) | 10 testes do contrato do endpoint. |
| `src/app/layout.tsx` | Monta `<ClientErrorReporter />` ao lado de `<ServiceWorkerRegister />`. |
| `src/app/error.tsx` | Passa a usar o `error` que já recebia, reportando `type: "boundary"` quando a flag está ligada. Tela inalterada. |

### Desvios do escopo escrito (ambos deliberados, ambos reversíveis)

1. **`next/dynamic` com `ssr: false` não foi usado** — o App Router não aceita
   essa chamada dentro de um Server Component, e o layout raiz é um. O gate
   ficou num `import()` dinâmico dentro do `useEffect` do componente client,
   que entrega o mesmo resultado no bundle e é ainda mais estrito: com a flag
   desligada o chunk sequer é requisitado. Confirmado no build (ver critério 1).
2. **`?debug=0` foi implementado junto do `?debug=1`** — o INC só previa ligar.
   Sem o desligar, a única forma de tirar a instrumentação do iPhone seria
   limpar os dados do site, o que derrubaria também sessão e Service Worker
   (justamente o estado que se quer preservar durante a investigação). São 3
   linhas simétricas em `debug-flag.ts`; se for escopo demais, é fácil remover.

### Decisões tomadas dentro do escopo (registradas para não virarem surpresa)

- **Valor de rejeição que não é `Error` nem `string` não é serializado** — vai só
  o nome do tipo (`[Response]`, `[object]`). Um objeto arbitrário poderia
  carregar dado do usuário, e "nunca logar dado pessoal" (CLAUDE.md) pesa mais
  que o detalhe do diagnóstico. Mesmo tratamento nos argumentos de `console.error`.
- **O IP entra no rate limit mas nunca no log** — dado pessoal.
- **O `fetch` vai com `credentials: "omit"`** — o endpoint não autentica e não
  deve receber o cookie de sessão.
- **Toda request conta no rate limit**, inclusive as inválidas (diferente do
  login, que só conta falha): aqui não existe uso legítimo de alto volume.
- **Campos sem limite declarado pelo INC** (`route`, `userAgent`, `tenantSlug`)
  são **truncados**, não rejeitados — user-agent exótico é ruído de log, não
  cliente malformado; rejeitar perderia o diagnóstico.
- **`PUBLIC_PATHS` não foi tocado**, como o mapa previa. Confirmado em runtime:
  o POST sem sessão responde 204, sem redirect do middleware.

### Verificação executada

- **Testes:** 317 → **327** (60 → 61 arquivos). Os 10 novos cobrem payload válido,
  ausência dos opcionais, campo fora do schema, `type` inválido, `message` vazia/
  acima de 500, `stack` acima de 4000, `timestamp` inválido, JSON malformado,
  corpo não-objeto, 413 acima de 8 KB, descarte de querystring, ausência do IP no
  log, rate limit por IP e contagem de requests inválidas.
- **Smoke ponta a ponta** contra `next start` (build de produção): `health=200`,
  válido `204`, campo extra `400`, 9 KB `413`, querystring `204` com
  `?token=SEGREDO` ausente da linha logada, `GET` `405`. As duas linhas
  `[CLIENT_ERROR]` apareceram no stdout do servidor.
- **Bundle:** chunk sempre carregado 1,1 KB sem referência ao endpoint; módulo
  pesado isolado em chunk de 1,9 KB.
- **`npm run lint && npm run typecheck && npm run test && npm run build`** verdes.

### O que NÃO foi verificado

**Nenhum teste em browser real foi executado por mim** — não há Chrome/Safari
dirigível neste ambiente, e o projeto não tem jsdom (DP-21 barra o install).
Portanto os listeners, o wrap de `console.error`, o dedupe e o fluxo `?debug=1`
estão provados por leitura e pelo contrato do endpoint, **não** por execução no
browser. O critério 6 é justamente essa execução, e continua aberto.

Também não foi verificada nenhuma hipótese sobre as falhas do iPhone: este INC
instrumenta, não corrige, e não tocou em aplaudir/foto/candidatura/push.
