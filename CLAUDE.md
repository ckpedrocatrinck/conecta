# CLAUDE.md — Projeto Conecta

Plataforma de comunicação interna para PMEs (piloto: Rede Vale Verde).
Monolito Next.js App Router + TypeScript estrito + PostgreSQL/Prisma + Tailwind/shadcn. PWA mobile-first.

## Fonte de verdade

- A documentação completa vive em `docs/` (vault Obsidian versionado). Em conflito entre código e docs, **docs vence** — e o conflito deve ser reportado, não resolvido silenciosamente.
- Escopo de trabalho = o arquivo do INC atual em `docs/04-Roadmap/incrementos/`. Critérios de aceite são o contrato.
- Decisões de arquitetura estão em `docs/02-Arquitetura/ADR/`. Só ADRs com status **Aceito** valem.
- Requisitos LGPD (`docs/03-LGPD/lgpd-requisitos-tecnicos.md`) valem em TODO INC que toca dados pessoais.

## Regras invioláveis

1. **Você é executor, não arquiteto.** Nunca decida arquitetura, altere escopo ou "melhore" além do INC. Falta algo na doc? PARE e pergunte.
2. Um INC por vez, na branch `inc-XXX-nome-curto`. Nunca commitar na `main`.
3. Commits: Conventional Commits com referência ao INC → `feat(INC-004): ...`
4. INC só termina com **Relatório de Entrega** (formato em `docs/00-Processo/fluxo-de-trabalho.md`).
5. Nunca commitar segredos. `.env` no gitignore; novidade de env vai no `.env.example` com comentário.
6. `AnnouncementAck` é imutável: nenhum caminho de UPDATE/DELETE na aplicação, jamais.
7. Toda query de domínio passa pela camada de acesso com tenant do contexto. Nenhum endpoint aceita `tenant_id` do cliente.
8. Login é por **CPF completo + senha** (ADR-006). CPF só como hash determinístico com pepper (env), nunca em claro.
9. Migração que cria/altera tabela: escrever/ajustar à mão e aplicar com `prisma migrate deploy` — nunca `prisma migrate dev` (ver ADR-008, coluna GENERATED `search_vector`).

## Convenções de código

- TypeScript `strict`; sem `any` não justificado em comentário.
- Código, nomes e comentários em **inglês**; strings de UI em **pt-BR**, centralizadas.
- Datas: UTC no banco; converter para `America/Sao_Paulo` só na exibição.
- Senhas: argon2id/bcrypt. CPF: nunca em claro (hash com pepper). Nunca logar dado pessoal.
- Mobile-first: toda tela de colaborador deve funcionar em viewport 360px.
- Testes obrigatórios no núcleo jurídico (numeração de CI, versionamento, acks, pendências, isolamento de tenant). UI simples não exige teste no MVP.

## Comandos

- `npm run dev` — sobe local
- `npm run lint && npm run typecheck && npm run test` — deve passar ANTES de todo commit
- `npx prisma migrate dev` / `npx prisma db seed` — banco local

## Fluxo de sessão

1. Início de INC: leia o arquivo do INC + ADRs referenciados nele. Use plan mode e apresente o plano antes de editar.
2. Impedimento ou ambiguidade → pare, descreva o problema e aguarde; não improvise.
3. Fim de INC: gere o Relatório de Entrega com passo a passo de teste manual.
