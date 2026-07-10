# Conecta

Plataforma de comunicação interna para PMEs (piloto: Rede Vale Verde). Ver `CLAUDE.md` e `docs/` para produto, arquitetura e processo de trabalho.

## Rodando local

```bash
git clone <url-do-repo> && cd conecta
npm install
cp .env.example .env
npm run dev
```

Abra http://localhost:3000. Healthcheck em http://localhost:3000/api/health.

## Banco de dados

```bash
docker compose up -d      # sobe o Postgres local (postgres:16)
npx prisma migrate dev    # aplica as migrations
npx prisma db seed        # popula dados de desenvolvimento
docker compose down       # derruba o Postgres local (dados persistem no volume)
```

Detalhes de por que dev usa Docker Compose e a CI usa um service container nativo do
GitHub Actions (não o mesmo mecanismo): `docs/02-Arquitetura/infra-banco-dev-e-ci.md`.

## Qualidade

```bash
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run test       # Vitest (inclui testes de isolamento — precisa do Postgres do compose rodando)
npm run format     # Prettier (grava)
```

CI (GitHub Actions) roda migrate + seed + lint + typecheck + test em todo push de branch (exceto `main`), contra um Postgres efêmero (service container).
