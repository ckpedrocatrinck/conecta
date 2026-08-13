# Projeto Conecta — Documentação Central

> Nome provisório. Plataforma de comunicação interna e engajamento para PMEs brasileiras, nascida da substituição do portal legado na Rede Vale Verde (piloto).

**Dono do projeto:** Pedro Catrinck
**Última atualização:** 2026-07-09
**Status geral:** 📐 Fase de especificação (nenhuma linha de código escrita)

---

## Como este vault funciona

Este vault é a **fonte única de verdade** do projeto. Regras:

1. **Nada é implementado sem estar documentado aqui antes.** O Claude Code lê este vault antes de qualquer incremento.
2. **Toda decisão de arquitetura vira ADR** em `02-Arquitetura/ADR/`. ADRs têm status (Proposto → Aceito → Substituído) e nunca são apagados.
3. **Todo trabalho de implementação é um INC** (incremento) em `04-Roadmap/incrementos/`. Um INC só é marcado ✅ após revisão externa (fluxo em `00-Processo/fluxo-de-trabalho.md`).
4. **Decisões pendentes** ficam em `05-Decisoes-Pendentes.md` até serem resolvidas e promovidas a ADR ou spec.

## Mapa do vault

| Pasta | Conteúdo |
|---|---|
| `00-Processo/` | Fluxo de trabalho Claude ↔ Claude Code ↔ Pedro, convenções de git, prompts/slash commands, boas práticas de Claude Code |
| `01-Produto/` | Visão, tese, personas, escopo do MVP, o que ficou de fora |
| `02-Arquitetura/` | Stack, modelo de dados, ADRs |
| `03-LGPD/` | Bases legais, requisitos técnicos de privacidade |
| `04-Roadmap/` | Fases do projeto e incrementos (INC-001…N) com status |
| `05-Decisoes-Pendentes.md` | Perguntas abertas que bloqueiam ou moldam o projeto |

## Convenção de status

- ⬜ Não iniciado
- 🔄 Em andamento
- 🔍 Em revisão (Claude Code entregou, aguardando verificação)
- ✅ Concluído (revisado, commitado, branch mergeada)
- ⛔ Bloqueado (ver nota no próprio arquivo)

## Ordem de leitura para o Claude Code

1. `README.md` (este arquivo)
2. `01-Produto/visao-e-tese.md`
3. `01-Produto/escopo-mvp.md`
4. `02-Arquitetura/stack.md` e `02-Arquitetura/modelo-de-dados.md`
5. Todos os ADRs com status **Aceito**
6. `03-LGPD/lgpd-requisitos-tecnicos.md`
7. O INC atual em `04-Roadmap/incrementos/`
