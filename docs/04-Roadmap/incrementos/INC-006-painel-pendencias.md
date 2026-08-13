# INC-006 — Painel de pendências + visão do gestor

**Status:** ✅ Concluído
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
- [x] Números batem com o seed em cenários com filiais, desligados e versões reabertas — `tests/integration/pending-panel.test.ts` (denominador cai ao desligar usuário com ack histórico preservado; reabertura por versão material consistente com o INC-005).
- [x] Manager não enxerga pendências de outra filial — mesmo arquivo, cenário de isolamento (`getAnnouncementPendencyDetail`, `listAnnouncementPendencySummaries`, `getUserPendencyHistory` com `branchId` do gestor).
- [x] Consulta performa com 500 usuários × 100 comunicados no seed ampliado (< 1s) — `tests/integration/pending-panel-performance.test.ts`: **203.5ms** medidos.

## Registro de conclusão

- **Data:** 2026-07-13
- **Branch:** `inc-006-painel-pendencias`
- **Commit de merge (fast-forward):** `26841fd1cc431d7ea4bf164b257f0fed6a910784`
- **CI:** verde na branch antes do merge (mesmo commit foi fast-forwarded para a `main`; o workflow tem `branches-ignore: [main]` por desenho, então não roda de novo na main).
- **Decisões registradas:**
  - Denominador de pendência é uma leitura ao vivo de `status: active` (não um snapshot da data de publicação) — desligado sai do denominador na hora, mas o `AnnouncementAck` dele permanece intacto no histórico.
  - Escopo do gestor = a única filial dele (`User.branchId`); modelo atual não suporta gestor multi-filial — registrado como **DP-12** em `docs/05-Decisoes-Pendentes.md`.
  - `/pendencias` é área nova fora de `/admin` (primeira tela que aceita o papel `manager`, ver INC-003).
  - DP-11 (arquivado com pendência não resolvida) implementado como alerta no painel — marcado como resolvido em `docs/05-Decisoes-Pendentes.md`.
