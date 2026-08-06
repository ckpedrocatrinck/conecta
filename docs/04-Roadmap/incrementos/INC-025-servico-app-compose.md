# INC-025 — Serviço `app` no Docker Compose (dev/local)

**Status:** 🔄 em andamento
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

- [ ] **(a)** `docker compose up -d --build` sobe `app` + `postgres`; `/api/health` responde `200`
      de **dentro** da rede (`docker compose exec` / do container do scheduler) e de **fora**
      (`curl http://localhost:3000/api/health` no host).
- [ ] **(b)** `docker compose --profile scheduler up -d` encerra as linhas `FALHA` do INC-023: o log
      do agendador mostra `OK GET /api/cron/publish-announcements -> 200` real, não erro de conexão
      (`-> 000`).
- [ ] **(c)** Uma migration real roda via `prisma migrate deploy` **dentro do fluxo do container**, e
      o schema fica aplicado no `postgres` do compose.
- [ ] **(d)** Push continua funcional na imagem buildada: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` está
      presente no bundle do cliente (não `undefined`), o que exige passá-la como **build ARG** — é
      inlinada em tempo de build, não lida em runtime.
- [ ] `npm run lint && npm run typecheck && npm run test && npm run build` (build **local**, fora do
      Docker) continuam verdes.

## Registro de conclusão

_(a preencher no fechamento)_
