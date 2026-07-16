# INC-011 — Vagas internas + candidatura

**Status:** ✅ Concluído
**Fase:** 4
**Depende de:** INC-003 (e INC-009 para o card)

## Objetivo
Vaga como entidade com candidatura em 1 toque — a demo perfeita da diferença para a portal legado.

## Escopo
1. CRUD admin de vagas: cargo, descrição rich text, filial (ou todas), turno, requisitos, prazo, status.
2. Lista para o colaborador com filtro por filial; encerrada some da lista ativa.
3. Candidatura em 1 toque + observação opcional; cancelável enquanto a vaga estiver aberta; colaborador vê "minhas candidaturas" no perfil.
4. Admin: lista de candidatos por vaga (nome, filial, data, observação) + export CSV.
5. Vaga publicada gera card (template INC-009) no feed.

## Critérios de aceite
- [ ] Candidatura duplicada impossível.
- [ ] Prazo vencido encerra vaga automaticamente e bloqueia candidatura.
- [ ] Export de candidatos funcional.

## Registro de conclusão
**Data:** 2026-07-14
**Branch:** inc-011-vagas-internas
**Merge em main:** d560024 (`--no-ff`, 2026-07-14)

Reconciliação de vault de 2026-07-16 (achado A6-1 da auditoria): código mergeado e presente na main, mas este registro e a marcação no roadmap ficaram vazios/`⬜` até esta data. Preenchido a partir do `git log`, sem Relatório de Entrega original recuperável — se um relatório detalhado for necessário, verificar histórico de conversa com o Claude Code na época.
