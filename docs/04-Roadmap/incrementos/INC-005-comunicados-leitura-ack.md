# INC-005 — Comunicados: leitura e confirmação de ciência

**Status:** ✅ Concluído
**Fase:** 2
**Depende de:** INC-004
**ADRs relevantes:** 001

## Objetivo
Colaborador lê comunicados no celular e declara ciência com registro probatório.

## Escopo
1. Lista do colaborador: não lidos primeiro, badge de pendente de confirmação, busca e filtro por categoria; estados visuais claros (novo | lido | confirmado).
2. Leitura em texto nativo responsivo; registro de `AnnouncementRead` na primeira abertura por versão.
3. Botão "Declaro ciência" (apenas se `requires_ack`): grava usuário, timestamp UTC, versão e `content_hash_at_ack`; UI mostra data/hora em America/Sao_Paulo; ação irreversível pela UI.
4. Se houver versão nova material após ack: item volta a pendente com aviso "este comunicado foi atualizado".
5. Home do colaborador: card fixo "X comunicados aguardando sua ciência" — **não dispensável** enquanto houver pendência (anti-padrão do X da portal legado).

## Critérios de aceite
- [ ] Ack duplicado impossível (constraint + UI idempotente).
- [ ] Ack registra o hash da versão exibida no momento (teste cobrindo corrida com edição simultânea).
- [ ] Pendência reaberta por versão material aparece para quem já tinha confirmado.
- [ ] Fluxo inteiro utilizável em viewport 360px.

## Registro de conclusão

- **Data:** 2026-07-10
- **Branch:** `inc-005-comunicados-leitura-ack`
- **Commit de merge (fast-forward):** `361b5dfc7d9ed89bb7ad9f3f6eac75bf72bcd6c1`
- **CI:** verde na branch antes do merge (mesmo commit foi fast-forwarded para a `main`; o workflow tem `branches-ignore: [main]` por desenho, então não roda de novo na main).
- **Decisões registradas:** DP-11 (`docs/05-Decisoes-Pendentes.md`) — arquivar comunicado com pendência aberta absolve a pendência; aceito para o MVP, sugerido como métrica para o INC-006.
