# INC-002 — Schema, migrations e multi-tenancy

**Status:** ⬜ Não iniciado
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
- [ ] `prisma migrate dev` + seed funcionam do zero.
- [ ] Testes de isolamento passando na CI.
- [ ] `AnnouncementAck` sem caminho de UPDATE/DELETE pela camada de acesso.
- [ ] Datas em UTC no schema.

## Registro de conclusão
_(preencher)_
