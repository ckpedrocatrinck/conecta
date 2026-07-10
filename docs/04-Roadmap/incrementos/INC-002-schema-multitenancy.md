# INC-002 — Schema, migrations e multi-tenancy

**Status:** ✅ Implementado (aguardando revisão/merge)
**Fase:** 1
**Depende de:** INC-001
**ADRs relevantes:** 001, 003, 006
**Docs:** `02-Arquitetura/modelo-de-dados.md`, `03-LGPD/lgpd-requisitos-tecnicos.md`

## Objetivo
Banco PostgreSQL com o modelo de dados completo do MVP, RLS por tenant ativa e testada.

## Escopo
1. Prisma schema implementando `modelo-de-dados.md` (fundação + comunicados + feed + vagas), com comentários apontando divergências, se houver.
2. Migrations versionadas; seed de desenvolvimento (1 tenant, 3 filiais, ~30 usuários fake, dados de exemplo por módulo).
3. RLS: políticas por `tenant_id`; camada de acesso da aplicação que injeta tenant do contexto (mesmo antes de existir auth real, via contexto fake de dev).
4. **Teste automatizado de isolamento**: consultas do tenant A jamais retornam dados do tenant B (mínimo: users, announcements, acks, posts, jobs).
5. Implementar (não decidir — já resolvido no **ADR-006**): `AnnouncementRead` grava só a primeira abertura por versão; `User` com `status` e `anonymized_at` para o ciclo de vida; `cpf_hash` determinístico. A rotina de anonimização em si é do INC-013; aqui só o schema precisa suportá-la.

## Critérios de aceite
- [x] `prisma migrate dev` + seed funcionam do zero — validado localmente (Postgres recém-criado via `docker compose up -d`, `prisma migrate dev` x2 + `prisma db seed`, sem erro).
- [x] Testes de isolamento passando — 28/28 localmente (`npm run test`); CI configurada com service container Postgres para rodar o mesmo conjunto a cada push.
- [x] `AnnouncementAck` sem caminho de UPDATE/DELETE pela camada de acesso — repositório só exporta `create`/`findBy...`; banco também recusa via trigger (testado inclusive contra a role owner e contra TRUNCATE).
- [x] Datas em UTC no schema — todos os campos de data/hora são `@db.Timestamptz` ou `@db.Date`; conversão para America/Sao_Paulo fica para a camada de exibição (INCs futuros).

## Registro de conclusão
- **Data:** 2026-07-10
- **Branch:** `inc-002-schema-multitenancy`
- **Ver Relatório de Entrega** na sessão de execução para decisões tomadas, passo a passo de teste manual e pendências. Merge para `main` a cargo do Pedro após revisão.
