# ADR-005 — Stack: Next.js + TypeScript + PostgreSQL + Prisma

**Status:** Aceito
**Aceito em:** 2026-07-09 (Pedro Catrinck)
**Data:** 2026-07-09
**Decisores:** Pedro Catrinck

## Contexto
Time de 1 pessoa executando via Claude Code. Prioridades: velocidade de iteração, um único deploy, bom suporte do modelo à stack, PWA de qualidade, e Postgres por causa do RLS multi-tenant (ADR-003). Detalhamento em `02-Arquitetura/stack.md`.

## Decisão
Monolito modular **Next.js (App Router, TS estrito) + Tailwind/shadcn + PostgreSQL + Prisma + Auth.js (credentials)**, hospedado em Vercel + Postgres gerenciado (Neon/Supabase) no piloto. Web Push nativo. Sem microsserviços, filas ou cache distribuído no MVP.

## Alternativas consideradas
- **Laravel/PHP** — excelente para CRUD e barato de hospedar, mas PWA/push e tipagem ponta a ponta piores, e menor fluidez no fluxo com Claude Code; rejeitada.
- **Backend separado (NestJS/FastAPI) + SPA** — separação limpa, porém dobra superfície de deploy e auth para benefício nulo no tamanho atual; rejeitada.
- **Supabase como backend completo (BaaS)** — acelera, mas acopla auth/RLS ao fornecedor cedo demais; aceito apenas como Postgres gerenciado.

## Consequências
+ Um repositório, um deploy, tipagem do banco à tela.
+ RLS disponível para o ADR-003.
− Vercel pode ficar caro em escala → gatilho abaixo.
− Lock-in leve em Next.js — aceito conscientemente.

## Gatilho de revisão
Custo de infra > ~10% da receita OU necessidade de workers persistentes → avaliar VPS/containers (Railway, Fly, Hetzner).
