# INC-010 — Aniversariantes + reações

**Status:** ✅ Concluído
**Fase:** 3
**Depende de:** INC-008, INC-009

## Objetivo
Conteúdo automático diário (motivo de retorno) sem nenhum trabalho do RH.

## Escopo
1. Tela/bloco "Aniversariantes": hoje + próximos 7 dias, filtro por filial, gerado por query sobre o cadastro (sem manutenção).
2. Respeita `birthday_visible=false` (não aparece; sem buraco visual denunciando a omissão).
3. Card de aniversariante do dia usando template do INC-009.
4. Reação única (👏) em posts: toggle por usuário, contador agregado.

## Critérios de aceite
- [ ] Colaborador com opt-out não aparece em nenhuma superfície (tela, card, busca de marcação de aniversário).
- [ ] Virada de dia respeita America/Sao_Paulo (teste de fuso).
- [ ] Reação idempotente (spam de toque não duplica).

## Registro de conclusão
**Data:** 2026-07-14
**Branch:** inc-010-aniversariantes-reacoes
**Merge em main:** 6846509 (`--no-ff`, 2026-07-14)

Reconciliação de vault de 2026-07-16 (achado A6-1 da auditoria): código mergeado e presente na main, mas este registro e a marcação no roadmap ficaram vazios/`⬜` até esta data. Preenchido a partir do `git log`, sem Relatório de Entrega original recuperável — se um relatório detalhado for necessário, verificar histórico de conversa com o Claude Code na época.
