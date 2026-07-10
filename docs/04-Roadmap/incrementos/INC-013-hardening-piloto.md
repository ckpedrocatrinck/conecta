# INC-013 — Hardening pré-piloto

**Status:** ⬜ Não iniciado
**Fase:** 5 — Piloto
**Depende de:** Todos os anteriores

## Objetivo
Sistema pronto para dados reais de pessoas reais.

## Escopo
1. Passar o checklist inteiro de `03-LGPD/lgpd-requisitos-tecnicos.md` e marcar item a item com evidência.
2. Backup automático do banco + **teste de restore documentado** (executado de verdade, com print/log no vault).
3. Rate limits revisados; headers de segurança (CSP básica, etc.).
4. Aviso de privacidade final (substituir placeholder) — entrada do jurídico/decisão de Pedro.
5. Seed de produção do piloto: import real de filiais e colaboradores do Vale Verde (com autorização formal — ver fase 0).
6. Runbook de go-live: passo a passo, plano de rollback, canal de suporte (Pedro) comunicado ao RH.
7. Instrumentação das métricas do piloto (ativos/mês, taxa de confirmação em 7 dias, tempo de publicação) — painel simples ou queries documentadas.

## Critérios de aceite
- [ ] Checklist LGPD 100% marcado com evidências.
- [ ] Restore de backup executado com sucesso em ambiente limpo.
- [ ] Métricas do piloto consultáveis.
- [ ] Runbook revisado no chat.

## Registro de conclusão
_(preencher)_
