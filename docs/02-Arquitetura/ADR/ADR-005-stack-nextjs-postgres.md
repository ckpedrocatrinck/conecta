# ADR-005 — Stack: Next.js + TypeScript + PostgreSQL + Prisma

**Status:** Aceito — **parte de infraestrutura substituída pelo ADR-011 (ver Emenda abaixo)**
**Aceito em:** 2026-07-09 (Pedro Catrinck)
**Data:** 2026-07-09
**Decisores:** Pedro Catrinck
>
> **Emenda (2026-07-31) — ver ADR-011.** As escolhas de **hospedagem (Vercel), banco gerenciado (Neon/Supabase) e storage** deste ADR foram **substituídas** pelo ADR-011: produção em **VPS único na Hostinger (São Paulo)**, **PostgreSQL e MinIO no próprio VPS**, tudo no Brasil. Permanece válido deste ADR o núcleo de aplicação: **Next.js + TypeScript + PostgreSQL + Prisma + Auth.js + RLS**. O Vercel segue apenas para demo/homologação (Fase 2 do ADR-011).

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

> **Gatilho ACIONADO em 2026-07-31.** Motivo: orçamento zero até o 1º contrato + exigência de residência de dados no Brasil (LGPD) tornaram a hospedagem gerenciada inviável/inadequada. Resposta: **VPS Hostinger São Paulo (ADR-011)**.
