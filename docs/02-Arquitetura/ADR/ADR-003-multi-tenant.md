# ADR-003 — Multi-tenant por schema compartilhado desde o dia 1

**Status:** Aceito
**Aceito em:** 2026-07-09 (Pedro Catrinck)
**Data:** 2026-07-09
**Decisores:** Pedro Catrinck

## Contexto
O piloto é uma empresa só, mas a tese de negócio é vender para várias PMEs da região. Retrofitar multi-tenancy depois é uma das migrações mais caras que existem (toca todas as queries, toda a auth, todos os índices). Por outro lado, infraestrutura multi-tenant sofisticada (um banco por cliente) é overkill para um fundador solo.

## Decisão
**Schema compartilhado com `tenant_id` em toda tabela de domínio** + Row-Level Security do PostgreSQL como segunda linha de defesa (política por `tenant_id` de sessão). Toda query passa por camada de acesso que injeta o tenant do contexto autenticado; nenhum endpoint aceita `tenant_id` do cliente.

## Alternativas consideradas
- **Single-tenant no piloto, migrar depois** — mais rápido agora, dívida brutal depois; rejeitada.
- **Banco/schema por tenant** — isolamento máximo, mas complexidade operacional (migrations × N, provisioning) incompatível com time de 1; rejeitada no MVP.

## Consequências
+ Onboarding de novo cliente = insert de tenant + import de colaboradores.
+ Custo de infra único no início.
− Disciplina obrigatória: teste automatizado de isolamento entre tenants entra na esteira (INC-002/003).
− Um vazamento de query sem filtro afeta todos — mitigado por RLS.

## Gatilho de revisão
Cliente enterprise exigir isolamento físico de dados → oferecer tier com banco dedicado.
