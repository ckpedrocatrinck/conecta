# INC-020 — Fuso do datetime-local (agendamento/prazo grava horário errado)

**Status:** ✅ Concluído
**Fase:** 2 — Núcleo jurídico / correção
**Depende de:** INC-018 (criou `fromDatetimeLocalSaoPaulo`), INC-005 (fuso America/Sao_Paulo), INC-011 (vagas)
**Resolve:** DP-23
**Branch:** `inc-020-fuso-datetime-local`

## Objetivo

Corrigir o bug de fuso em **três** telas que convertem `<input type="datetime-local">` em `Date` com `new Date(valorCru)`. Em produção (`TZ=UTC`), isso grava **3h adiantado** do que o admin digitou (São Paulo é UTC−3). Num produto cuja tese é provar *quando* algo foi comunicado, horário errado no *quando* é dano ao núcleo. O conserto já existe e está provado: `fromDatetimeLocalSaoPaulo()` (INC-018), que lê o offset real de São Paulo via ICU (não fixa −03:00) e valida por round-trip.

## Contexto (mapa read-only confirmado 2026-07-31)

Existem exatamente **4** inputs `datetime-local` no projeto; **3 gravam com o bug**, 1 já está correto:

| Arquivo:linha | Campo | Estado |
|---|---|---|
| `comunicados/[id]/actions.ts:95` | `publishAt` (reagendar) | **BUG** — `new Date(publishAtRaw)` cru |
| `vagas/novo/actions.ts:19` | `deadline` (criar vaga) | **BUG** — `new Date(deadlineRaw)` cru |
| `vagas/[id]/actions.ts:20` | `deadline` (editar vaga) | **BUG** — `new Date(deadlineRaw)` cru |
| `comunicados/novo/actions.ts:127` | `publishAt` (agendar na criação) | OK — já usa `fromDatetimeLocalSaoPaulo` (INC-018) |

Notas do mapa que evitam consertar pela metade:
- `vagas/[id]/form.tsx:73` já **pré-preenche** o prazo com `toDatetimeLocalSaoPaulo(job.deadline)` (leitura correta) — só a **gravação** no submit está errada. Não há assimetria a introduzir: aqui é trocar uma linha.
- `comunicados/[id]` e `vagas/novo` têm input **sem** `defaultValue` (campo vazio ao abrir) — não há leitura a corrigir, só a gravação.
- Não existe 4ª tela. Os demais `new Date(...)` do grep são `type="date"` (dia inteiro, sem hora — não deslocam: `birthDate`, `hiredAt`, `eventDate`), `new Date()` sem argumento (timestamp "agora"), ou fixtures de teste. Todos **fora de escopo**.

## Escopo

1. Trocar `new Date(<valorCru>)` por `fromDatetimeLocalSaoPaulo(<valorCru>)` nos **três** pontos com bug:
   - `comunicados/[id]/actions.ts:95` (`publishAt`)
   - `vagas/novo/actions.ts:19` (`deadline`)
   - `vagas/[id]/actions.ts:20` (`deadline`)
2. Preservar a validação que já existir em cada action (ex.: rejeitar data no passado, campo obrigatório). `fromDatetimeLocalSaoPaulo` já rejeita data inválida por round-trip (ex.: `2026-02-30T08:00`) — se a action hoje trata `new Date(...)` inválido de algum jeito específico, manter o comportamento de erro equivalente (mensagem/redirect), não regredir.
3. Nenhuma mudança de leitura/pré-preenchimento: `vagas/[id]` já está certo; os outros dois não têm pré-preenchimento por serem criação/vazios.

## Teste (o que teria pego o bug — obrigatório)

O `fromDatetimeLocalSaoPaulo` já tem round-trip em `format-datetime.test.ts`. O buraco nunca foi a função — foi **a action não chamar a função**. Então o teste que faltava é por action, não por util:

- Para cada uma das 3 actions corrigidas, um teste que **grava** a partir de um valor de datetime-local conhecido (ex.: `"2026-08-14T08:00"`) sob `TZ` de processo = UTC (o cenário de produção que esconde o bug) e afirma que o instante gravado, relido e reconvertido para São Paulo, é **08:00** — não 05:00 nem 11:00. Ou seja: round-trip **através da Server Action**, provando que ela usa o helper.
- Seguir o precedente de teste de action já existente no projeto (`announcement-create-actions.test.ts` do INC-018: `vi.mock` de `requireAdmin`/`redirect`, import dinâmico após o mock, banco real). Sem jsdom (o projeto não tem; DP-21 barra install).
- Incluir o caso de **data no passado** e **data inválida** em pelo menos uma das actions, confirmando que a correção não afrouxou a validação existente.

Racional: sem o teste por action, conserta-se agora e o próximo INC que mexer em data reabre o mesmo furo — a util verde dá falsa confiança de que a gravação está certa.

## Fora de escopo

- `type="date"` (dia inteiro) — não desloca, não tocar.
- Qualquer refactor de `format-datetime.ts` — as funções estão certas e testadas; só passam a ser chamadas onde faltava.
- INC-018 (ainda não mergeado), R2, DP-24/DP-25, os 4 arquivos untracked.

## Critérios de aceite

- [x] As 3 actions usam `fromDatetimeLocalSaoPaulo`; `git grep "new Date(" -- comunicados/[id]/actions.ts vagas/novo/actions.ts vagas/[id]/actions.ts` só retorna comentários explicativos, nenhuma conversão de datetime-local.
- [x] Teste de round-trip por action (as 3), provando 08:00→UTC→08:00 sob `TZ=UTC`. `announcement-schedule-action.test.ts` + `job-opening-actions.test.ts`.
- [x] Validação de data no passado/inválida preservada (não regrediu) — testes explícitos confirmam o comportamento atual (aceita passado, rejeita inexistente) idêntico ao anterior.
- [x] `vagas/[id]` continua pré-preenchendo o prazo corretamente (não tocado — só a gravação mudou).
- [x] `npm run lint && npm run typecheck && npm run test && npm run build` verdes.

## Reconciliação de vault (parte da entrega)

- Escrever `docs/04-Roadmap/incrementos/INC-020-fuso-datetime-local.md` no padrão dos outros INCs, com Registro de Conclusão.
- `docs/05-Decisoes-Pendentes.md`: mover **DP-23** para resolvida (por este INC), anotando que cobria as 3 telas — não só `comunicados/[id]`.
- `docs/04-Roadmap/roadmap.md`: marcar INC-020 ✅.

## Verificação manual (dev local)

Com `TZ` do dev refletindo o problema (ou confiando no teste automatizado, que é o juiz real aqui): reagendar um comunicado pela tela `[id]` para 08:00 → reabrir e conferir 08:00; criar e editar vaga com prazo → conferir o horário salvo/reexibido bate com o digitado.

## Registro de conclusão

- **Concluído em:** 2026-07-31
- **Branch:** `inc-020-fuso-datetime-local`
- **As 3 trocas:** `scheduleAnnouncementAction` (`comunicados/[id]/actions.ts`),
  `createJobOpeningAction` (`vagas/novo/actions.ts`) e `updateJobOpeningAction`
  (`vagas/[id]/actions.ts`) passaram a usar `fromDatetimeLocalSaoPaulo` no lugar
  de `new Date(valorCru)`. Nas 3, a guarda de validação foi simplificada de
  `!valor || Number.isNaN(valor.getTime())` para `!valor` — redundante depois
  da troca, porque `fromDatetimeLocalSaoPaulo` já devolve `null` (nunca um
  `Date` inválido) para entrada vazia, malformada ou data inexistente
  (round-trip). Mensagem/parâmetro de erro de cada action preservado
  (`?erro=data-invalida` em comunicados, `?erro=obrigatorio` em vagas).
- **Validação de "data no passado":** confirmado por leitura, antes de mexer,
  que **nenhuma das 3 actions** tinha essa checagem hoje (diferente de
  `createAndScheduleAnnouncementAction`, tela `novo`, que já rejeita passado
  desde o INC-018). Não foi introduzida — mudaria escopo. Os testes novos
  provam explicitamente que esse comportamento (aceitar data passada) continua
  idêntico depois da troca.
- **Achado documentado no teste, não no código:** em Vagas não existe um
  `?erro=data-invalida` próprio — uma data inexistente (ex. `30/fev`) faz
  `fromDatetimeLocalSaoPaulo` devolver `null`, o `deadline` fica falsy, e cai
  no mesmo ramo do campo obrigatório (`?erro=obrigatorio`). Comentado
  explicitamente em `job-opening-actions.test.ts` para o teste não virar
  armadilha se algum dia alguém introduzir uma mensagem de erro específica
  para data de vaga.
- **Testes (critério central do INC):** dois arquivos novos, provando o
  round-trip **através da própria Server Action** sob `TZ=UTC` de processo
  forçado (`vi.stubEnv("TZ", "UTC")`) — o cenário de produção/CI que escondia
  o bug; sem forçar TZ, uma máquina dev cujo SO já esteja em
  America/Sao_Paulo faria o teste passar mesmo com o código antigo.
  - `tests/integration/announcement-schedule-action.test.ts` (3 testes):
    round-trip 08:00→UTC→08:00 via `scheduleAnnouncementAction`; data
    inexistente rejeitada (`?erro=data-invalida`, nada muda); data no passado
    aceita (comportamento preservado).
  - `tests/integration/job-opening-actions.test.ts` (5 testes): round-trip via
    `createJobOpeningAction` e via `updateJobOpeningAction`; data inexistente
    rejeitada (`?erro=obrigatorio`, nada é criado/alterado) na criação e na
    edição; data no passado aceita na criação (comportamento preservado).
- **Suíte:** 292 → **313 testes** (57 → 59 arquivos), todos verdes, junto de
  `npm run lint`, `npm run typecheck` e `npm run build`.
- **Sem migration, sem mudança de GRANT/RLS** — troca é só na camada de
  aplicação, nenhuma tabela/coluna nova.
- **Pendências / dívidas técnicas:** nenhuma nova. DP-24 e DP-25 (achadas no
  INC-018) seguem em aberto, fora do escopo deste INC.
