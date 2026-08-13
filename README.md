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
npx prisma migrate deploy # aplica as migrations existentes, na ordem
npx prisma db seed        # popula dados de desenvolvimento
docker compose down       # derruba o Postgres local (dados persistem no volume)
```

**Por que `migrate deploy` e não `migrate dev`:** este projeto tem uma coluna
`GENERATED` (`announcement_versions.search_vector`, busca full-text) que o
Prisma não modela nativamente. `prisma migrate dev` calcula um diff contra
uma shadow database e tenta "corrigir" essa coluna com um comando que o
Postgres recusa — na melhor hipótese trava com erro; na pior, é interpretado
como drift e o Prisma oferece resetar o banco (apaga tudo e reexecuta o
seed). `migrate deploy` só aplica as migrations pendentes em ordem, sem
diffing, e por isso nunca aciona esse problema — é o mesmo comando que a CI já
usa. Ver `ADR-008` (`docs/02-Arquitetura/ADR/ADR-008-migracoes-manuais-colunas-generated.md`)
para o histórico completo, e a regra 9 do `CLAUDE.md`.

Precisa **criar uma migration nova** (tabela/coluna nova)? Não é este comando
— siga o procedimento manual do `ADR-008` (seção "Decisão", passos 1-6):
gerar o SQL com `migrate dev --create-only` (sem aplicar), editar o arquivo
gerado à mão, e só então aplicar com `migrate deploy`.

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
