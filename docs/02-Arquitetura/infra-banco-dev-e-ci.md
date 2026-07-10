# Infra de banco: dev (Docker Compose) vs. CI (service container)

> Nota curta do INC-002. Complementa `stack.md` e `ADR-003`.

## Dois ambientes, dois mecanismos — de propósito

- **Dev local:** `docker-compose.yml` na raiz sobe um `postgres:16` persistente (volume nomeado `conecta_pgdata`), credenciais vindas do `.env` (nunca hardcoded no compose). Pensado para ficar de pé entre sessões (`docker compose up -d` / `down`).
- **CI (GitHub Actions):** um **service container** nativo do Actions (`services.postgres` em `.github/workflows/ci.yml`), efêmero, criado e destruído a cada run, com healthcheck `pg_isready`. **Não** é o `docker-compose.yml` de dev — a CI não depende de Compose, só do que o próprio Actions já sabe orquestrar (mais simples, mais rápido de provisionar por run, sem risco de vazar estado entre runs).
- O job de CI roda `prisma migrate deploy` (aplica as migrations existentes, sem diffing/prompt interativo — diferente de `migrate dev`, que é só para desenvolvimento) e `prisma db seed` antes de lint/typecheck/test.

## Duas roles Postgres, nos dois ambientes

Vale igualmente em dev e CI (ver `prisma/migrations/*_rls_and_triggers/migration.sql`):

- **Role owner/superuser** (`POSTGRES_USER` do compose / `conecta` na CI) — usada só por `prisma migrate` e pelo seed. É superuser porque a imagem oficial do Postgres sempre torna `POSTGRES_USER` superuser; superuser **sempre** ignora Row-Level Security, mesmo com `FORCE ROW LEVEL SECURITY`.
- **Role de runtime `conecta_app`** (não-superuser, criada por migration, sem senha versionada) — é quem a aplicação e os testes de isolamento usam de fato (`APP_DATABASE_URL`). Só com uma role não-superuser a RLS por `tenant_id` (ADR-003) é real, não decorativa.
- A senha de `conecta_app` nunca fica em SQL versionado: `ALTER ROLE conecta_app PASSWORD ...` roda a partir de `APP_DB_PASSWORD` (env) toda vez que o seed executa (`prisma/db-admin.ts`).

## Variáveis de ambiente novas (INC-002)

`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (compose), `DATABASE_URL` (role owner), `APP_DB_PASSWORD` + `APP_DATABASE_URL` (role `conecta_app`), `CPF_HASH_PEPPER` (ADR-006). Documentadas com comentário em `.env.example`; valores reais nunca commitados.
