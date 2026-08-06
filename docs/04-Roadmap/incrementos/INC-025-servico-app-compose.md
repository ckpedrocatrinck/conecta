# INC-025 — Serviço `app` no Docker Compose (dev/local)

**Status:** 🟡 Código completo (2026-08-06) — 3 dos 4 critérios verificados; o (d) depende de
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` entrar no `.env` do Pedro (ver Registro de conclusão)
**Fase:** infra (pré-piloto)
**Origem:** investigação de 2026-08-06 (Pedro) — as 4 peças que o ADR-011 §8 pressupõe não existem no repo
**Depende de:** ADR-011 (§8 arquitetura de produção), INC-023 (agendador)

## Objetivo

Fazer a aplicação rodar **dentro do Docker Compose**, ao lado do `postgres` que já existe, para
que o agendador do INC-023 tenha um alvo real e para que o build de produção do Next passe a ser
exercitado neste projeto pela primeira vez.

## Escopo

**Dev/local apenas.** Este INC entrega a imagem e o serviço; **não** entrega o pipeline
CI→GHCR→VPS do ADR-011 §9 (build no GitHub Actions, push para o GHCR, VPS só puxando), que fica
para quando houver contrato/servidor. Aqui o `app` é buildado localmente (`build:` no compose),
não puxado de registry. Também ficam fora: `minio` e `proxy` (ADR-011 §8), HTTPS/Traefik (§13) e
qualquer segredo de produção.

As 4 peças ausentes, confirmadas por investigação em 2026-08-06:

1. **`next.config.ts` — `output: "standalone"`.** Hoje o objeto `nextConfig` tem só
   `allowedDevOrigins` e `headers()`; não existe chave `output` de nenhum tipo. Sem ela, `next build`
   não emite `.next/standalone/server.js`, que é exatamente o que o ADR-011 §8 manda o serviço `app`
   executar (`node server.js`).
2. **`Dockerfile`.** Não existe nenhum no repo (verificado por `git ls-files`, `find` no filesystem
   e glob recursivo). Multi-stage `deps → builder → runner`.
3. **`.dockerignore`.** Não existe. Sem ele o contexto de build sobe `node_modules/`, `.next/`,
   `.git/` e — o que importa de verdade — os arquivos `.env`.
4. **Serviço `app` no `docker-compose.yml`.** Hoje o arquivo tem só `postgres` e `scheduler`; o
   `scheduler` está atrás de `profiles: ["scheduler"]` **precisamente porque** o `app` de
   `APP_INTERNAL_URL` não existe (comentário nas linhas 25-30 do compose e item 4 do INC-023).

## Critérios de aceite

- [x] **(a)** `docker compose up -d --build` sobe `app` + `postgres`; `/api/health` responde `200`
      de **dentro** da rede (`docker compose exec` / do container do scheduler) e de **fora**
      (`curl http://localhost:3000/api/health` no host).
- [x] **(b)** `docker compose --profile scheduler up -d` encerra as linhas `FALHA` do INC-023: o log
      do agendador mostra `OK GET /api/cron/publish-announcements -> 200` real, não erro de conexão
      (`-> 000`).
- [x] **(c)** Uma migration real roda via `prisma migrate deploy` **dentro do fluxo do container**, e
      o schema fica aplicado no `postgres` do compose.
- [ ] **(d)** Push continua funcional na imagem buildada: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` está
      presente no bundle do cliente (não `undefined`), o que exige passá-la como **build ARG** — é
      inlinada em tempo de build, não lida em runtime. **O encanamento está pronto e provado; a
      variável não existe no `.env`.** Ver "Critério (d)" abaixo — é ação do Pedro.
- [x] `npm run lint && npm run typecheck && npm run test && npm run build` (build **local**, fora do
      Docker) continuam verdes.

## Registro de conclusão

**Data:** 2026-08-06
**Branch:** `inc-025-servico-app-compose`
**Merge em main:** _(pendente — Pedro pediu revisão antes; é a primeira vez que build de produção
via Docker roda neste projeto)_

### O que foi entregue

| Peça | Arquivo | Commit |
|---|---|---|
| `output: "standalone"` | `next.config.ts` | `1c1389c` |
| Dockerfile multi-stage + `.dockerignore` | `Dockerfile`, `.dockerignore` | `880df10` |
| Serviços `app` e `migrate` | `docker-compose.yml` | `c367aa0` |

### Achados da investigação (o que mudou o desenho)

1. **O gotcha "Next standalone + Prisma" NÃO se reproduz no Next 16.2.10.** O trace do
   `output: "standalone"` já copia `node_modules/.prisma/client` **completo** — engine nativo
   (`query_engine-*.node`), `schema.prisma`, os runtimes WASM — e `@prisma/client`. Nenhum `COPY`
   manual foi necessário. **A condição real é outra:** o generator do `prisma/schema.prisma` **não
   declara `binaryTargets`**, então o engine é sempre o da plataforma onde `prisma generate` roda.
   Gerar no Windows produz `query_engine-windows.dll.node`, inútil no container — por isso o
   `generate` roda dentro do estágio `builder`.
2. **`next build` exige as URLs de banco PRESENTES, não um banco ALCANÇÁVEL.** A fase
   *Collecting page data* avalia os módulos de rota, e `src/lib/db/app-client.ts` instancia o
   PrismaClient em **escopo de módulo** (`export const appDb = createAppDbClient()`), lançando
   `APP_DATABASE_URL nao configurada`. O primeiro build da imagem morreu exatamente aí, em
   `/[slug]/manifest`. Build local com as duas URLs apontando para porta morta (`127.0.0.1:1`)
   concluiu normalmente — ou seja, o `instrumentation.register()` (que checa a role `conecta_app`
   de verdade) **não** roda no build, só no boot. Solução: dummies inertes no builder.
3. **⚠️ O trace do standalone copia o `.env` da raiz para dentro de `.next/standalone/`.** Verificado
   no build local: `.next/standalone/.env` existe depois do build. Se o `Dockerfile` fizesse
   `COPY .next/standalone ./` de um contexto com `.env`, o segredo entraria na imagem. Duas
   barreiras: o `.env*` no `.dockerignore` (o `.env` nem chega ao contexto) e um `rm -f ./.env*`
   explícito no estágio runner.
4. **As duas URLs de banco são lidas como STRING ÚNICA**, nunca montadas a partir de peças
   (`prisma/schema.prisma:31` via `env("DATABASE_URL")`; `src/lib/db/app-client.ts:14` via
   `datasourceUrl`). Não dá para "sobrescrever só o host" — o compose remonta a string inteira a
   partir de `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` (as mesmas peças que criam o banco no
   serviço `postgres`) + `APP_DB_PASSWORD` + o nome fixo de role `conecta_app`. Nenhum segredo novo.
5. **`AUTH_TRUST_HOST=true` é obrigatório no container.** A imagem roda com `NODE_ENV=production`, e
   `assertAuthTrustHostConfigured` (`src/lib/auth/assert-trust-host.ts`) **derruba o boot** fora de
   Vercel/CF sem `AUTH_TRUST_HOST` nem `AUTH_URL` — senão o Auth.js resolveria `trustHost=false` e
   todo login falharia. `AUTH_URL` foi deliberadamente **não** setada, para o host da requisição
   continuar valendo (localhost, IP de LAN, túnel).
6. **Base `node:22-slim`, não alpine** — decisão documentada no topo do Dockerfile: engine do Prisma
   sem `binaryTargets` + prebuild glibc do `sharp` (usado pelo `next/og` em
   `/api/posts/[id]/card-image`). Alpine exigiria alvo musl nos dois e um `apk add` de
   openssl/libc6-compat: mais superfície de erro para economizar ~80 MB.
7. **O runner não leva o CLI do Prisma nem a pasta `prisma/`** (é só o standalone), então
   `prisma migrate deploy` não roda com `docker compose exec app`. Daí o serviço **`migrate`**,
   one-shot no perfil `tools`, reusando o estágio `builder`.

### Verificações

- **(a)** `docker compose up -d` → `app` e `postgres` ambos `healthy`. `/api/health` → `200`
  `{"status":"ok"}` de fora (`curl http://localhost:3000/api/health` no host) **e** de dentro da rede
  (`docker run --rm --network conecta_default curlimages/curl … http://app:3000/api/health`).
- **Smoke de produto real** (além do critério): `GET /{slug}/login` servido pelo container →
  `200`, com `<title>Conecta</title>` e o campo de CPF. Resolver o slug exige consulta ao banco pela
  role `conecta_app`, então isso prova de uma vez `APP_DATABASE_URL`, a RLS e o middleware.
- **(b)** Dois ciclos completos do agendador, `OK … -> 200` nos dois, **zero linhas `FALHA`**. Log
  completo no `INC-023-correcoes-criticas-nucleo.md`, seção "Validação end-to-end dentro do Compose".
- **(c)** `docker compose run --rm migrate` contra o banco de dev → `No pending migrations to apply`
  (as 17 já estavam aplicadas). Como isso **não prova que uma migration aplica**, foi feito o teste
  real num banco descartável do mesmo cluster (`conecta_migrate_check`, criado e derrubado no mesmo
  fluxo): `All migrations have been successfully applied` — 17/17 em `_prisma_migrations`, 21 tabelas
  em `public`, e a coluna `GENERATED` `search_vector` presente em `announcement_versions` (ADR-008).
  Nenhum dado de dev foi tocado.
- **Gate local** (fora do Docker): `lint` limpo, `typecheck` limpo, **61 arquivos / 327 testes**
  passando (18,8s), `build` concluído.

### Critério (d) — encanamento pronto, valor ausente

Push **não** está funcional na imagem, e a causa **não é o Docker**:
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` não existe no `.env` da raiz.

Três evidências independentes:
1. Build **local** (que carrega o `.env`) emitiu no chunk do cliente
   `process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""` como **lookup em runtime** contra um shim vazio —
   é o que o Turbopack faz quando a variável está **indefinida** no build.
2. `docker compose config` resolve o build ARG para `""`.
3. Na imagem buildada, o chunk sai constant-folded: `applicationServerKey: (t = "=".repeat(0), …)` —
   chave vazia. `pushManager.subscribe` quebra com isso.

O encanamento foi **provado por experimento controlado**, nos dois caminhos: buildando com um valor
marcador (`BTESTINLINEMARKER…` local, `BDOCKERARGMARKER…` via `--build-arg`), o valor aparece
inlinado no chunk servido, dentro da imagem. Ou seja: **basta a variável existir.**

**Ação do Pedro** (o agente não tem permissão de ferramenta para ler nem editar `.env`/`.env.example`):
acrescentar `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<chave pública VAPID>` ao `.env` (e a linha comentada no
`.env.example`, regra 5 do CLAUDE.md), depois `docker compose build app && docker compose up -d app`.
Isso conserta o push **também no dev local**, que está com o mesmo problema hoje — é um gap
pré-existente do INC-012 que este INC apenas tornou visível, não introduziu.

### Pendências que este INC deixa

- **`.env` / `.env.example`** — além do `NEXT_PUBLIC_VAPID_PUBLIC_KEY` acima, continuam faltando as
  três linhas comentadas que o INC-023 já pedia (`APP_INTERNAL_URL`,
  `SCHEDULER_PUBLISH_INTERVAL_SECONDS`, `SCHEDULER_ANONYMIZE_AT_HOUR_UTC`). Mesmo bloqueio de
  permissão de ferramenta.
- **Perfil do `scheduler` mantido.** O INC-023 (item 4 das decisões) previa **remover** o perfil
  quando o serviço `app` entrasse. Não foi removido: sem o perfil, um `docker compose up` de máquina
  de desenvolvimento passaria a bater na app a cada 5 min e a rodar a anonimização diária sozinho.
  **Divergência doc × código, reportada e não resolvida silenciosamente** — decisão do Pedro.
- **Pipeline do ADR-011 §9 não implementado** (CI builda → GHCR → VPS puxa). Fora do escopo por
  decisão do Pedro. Quando entrar, o bloco `app` troca `build:` por `image: ghcr.io/…` e a porta
  3000 deixa de ser publicada (só o `proxy` fica exposto — ADR-011 §8).
- **Serviços `minio` e `proxy` do ADR-011 §8 continuam ausentes.** Enquanto isso, o mock de storage
  em disco (`.local-media`) é persistido pelo volume `conecta_media`; sai com o R2 (DP-19).
- **Anonimização diária nunca exercitada dentro do Compose** — só dispara às 03h UTC.
- **Aviso do Prisma:** `package.json#prisma` está deprecado e sai no Prisma 7 (migrar para
  `prisma.config.ts`). Não tocado aqui; é mudança de configuração fora do escopo deste INC.
