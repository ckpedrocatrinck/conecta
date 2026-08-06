# syntax=docker/dockerfile:1
#
# Imagem da aplicacao (INC-025). ADR-011 §8: o servico `app` roda o build
# standalone do Next (`node server.js`), atras do proxy, nunca exposto direto
# em producao.
#
# BASE: `node:22-slim` (Debian bookworm), NAO alpine. Motivo: o generator do
# `prisma/schema.prisma` nao declara `binaryTargets`, entao o engine gerado e'
# sempre o NATIVO da plataforma onde `prisma generate` roda. Em Debian isso e'
# `debian-openssl-3.0.x`, o alvo mais exercitado do Prisma, e o `sharp` que o
# `next/og` usa (rota /api/posts/[id]/card-image) tem prebuild glibc. Alpine
# exigiria alvo musl em ambos e um `apk add` de openssl/libc6-compat — mais
# superficie de erro para economizar ~80 MB que nao fazem diferenca numa VPS.
# `node:22` = mesma major do CI (`.github/workflows/ci.yml`, setup-node 22).

# ---------------------------------------------------------------------------
# deps — so' as dependencias, para a layer de `npm ci` sobreviver a mudanca
# de codigo-fonte. NAO setar NODE_ENV=production aqui: `npm ci` pularia as
# devDependencies (typescript, tailwind), que o build precisa.
# ---------------------------------------------------------------------------
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# builder — gera o client do Prisma e roda `next build`.
# ---------------------------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app

# O engine do Prisma linka contra libssl.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `prisma generate` tem que rodar AQUI, dentro do Linux: o engine e' escolhido
# pela plataforma de geracao. Gerar no Windows produz `query_engine-windows.
# dll.node`, inutil no container.
# O `npx prisma generate` exige que `env("DATABASE_URL")` do schema resolva —
# so' para ler o schema; nao conecta em banco nenhum.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build_only"
RUN npx prisma generate

# NEXT_PUBLIC_* e' INLINADA no bundle do cliente em tempo de build — nao ha'
# como injetar em runtime pelo Compose. Verificado em 2026-08-06: sem a var
# presente no build, o chunk sai com `process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
# ?? ""` resolvendo para string vazia, e `pushManager.subscribe` quebra.
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

# `next build` roda com NODE_ENV=production e importa toda rota, inclusive
# /api/auth — o Auth.js exige um segredo em producao. Valor inerte, so' de
# build: o AUTH_SECRET real chega em runtime pelo `env_file` do Compose.
# (Mesma razao e o mesmo comentario do `.github/workflows/ci.yml`.)
ENV AUTH_SECRET="build_only_dummy_secret"

# APP_DATABASE_URL precisa EXISTIR no build (nao precisa conectar): a fase
# "Collecting page data" avalia os modulos de rota, e `src/lib/db/app-client.ts`
# cria o PrismaClient em escopo de MODULO (`export const appDb = ...`),
# lancando "APP_DATABASE_URL nao configurada" se a var faltar. Sem esta linha
# o build morre em `/[slug]/manifest`. Valor inerte — o real vem em runtime.
#
# Verificado em 2026-08-06: o que o build exige e' a var PRESENTE, nao um banco
# ALCANCAVEL. Build local com as duas URLs apontando para porta morta
# (127.0.0.1:1) concluiu normalmente — o `instrumentation.register()`, que checa
# a role `conecta_app` de verdade, so' roda no boot do servidor.
ENV APP_DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build_only"
RUN npm run build

# ---------------------------------------------------------------------------
# runner — so' o standalone. Sem CLI do Next, sem node_modules completo,
# sem prisma CLI (migration roda pelo servico `migrate` do compose, que usa
# o estagio `builder`).
# ---------------------------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
# `server.js` faz bind em `process.env.HOSTNAME || '0.0.0.0'`. Deixar explicito
# porque o Docker seta HOSTNAME com o id do container, o que faria o bind ir
# para um nome que nao resolve.
ENV HOSTNAME=0.0.0.0

# `node:22-slim` ja' traz o usuario nao-root `node` (uid 1000).
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# Defesa em profundidade: o `.dockerignore` ja' impede o `.env` de entrar no
# contexto, mas o trace do standalone copia para dentro de `.next/standalone/`
# qualquer `.env` que exista na raiz no momento do build. Se um dia o ignore
# falhar, o segredo morre aqui.
RUN rm -f ./.env ./.env.* && rm -rf ./.local-media

# Mock de storage de midia (`src/lib/storage/local-media-fs.ts` grava em
# `cwd()/.local-media`). Montado como volume pelo Compose; o diretorio precisa
# existir e pertencer ao `node` antes do USER, senao o primeiro upload falha
# com EACCES. Sai quando o R2 entrar (DP-19).
RUN mkdir -p /app/.local-media && chown node:node /app/.local-media

USER node
EXPOSE 3000

# Sem curl/wget na imagem slim de proposito — o fetch global do Node 22 basta.
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
