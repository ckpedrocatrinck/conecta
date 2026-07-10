# INC-006 — Painel de pendências + visão do gestor

**Status:** ⬜ Não iniciado
**Fase:** 2
**Depende de:** INC-005

## Objetivo
RH e gestores enxergam quem falta confirmar o quê, por filial, em tempo real.

## Escopo
1. Admin, por comunicado: % de confirmação, lista de pendentes com filial, filtro por filial, drill-down por colaborador.
2. Admin, por colaborador: histórico de acks e pendências.
3. Manager: mesma visão restrita à(s) sua(s) filial(is).
4. Cálculo correto do denominador: usuários ativos do público-alvo na data de publicação (desligados saem do denominador de pendência mas acks históricos permanecem).

## Critérios de aceite
- [ ] Números batem com o seed em cenários com filiais, desligados e versões reabertas (testes de cálculo).
- [ ] Manager não enxerga pendências de outra filial (teste de permissão).
- [ ] Consulta performa com 500 usuários × 100 comunicados no seed ampliado (< 1s).

## Registro de conclusão
_(preencher)_
