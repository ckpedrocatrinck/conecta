# INC-023 — Correções críticas do núcleo jurídico (reabertura de pendência + agendamento)

**Status:** ⬜ Não iniciado
**Fase:** correção (pré-piloto)
**Origem:** teste manual real de 2026-08-04 (Pedro). Dois comportamentos do núcleo jurídico reportados como quebrados:
- INC-005, escopo item 4 / critério "Pendência reaberta por versão material aparece para quem já tinha confirmado" (checkbox nunca marcado no arquivo do INC).
- INC-012.5, Bloco A, item A2-1 (comunicado agendado não publicava).

> **Correção de premissa (2026-08-04, após investigação).** O spec original deste INC afirmava (a) que a reabertura de pendência por mudança material não estava implementada e (b) que o middleware bloqueava `/api/cron/publish-announcements` antes do handler avaliar o `CRON_SECRET`. **Nenhuma das duas se sustentou.** A reabertura está implementada e correta; o matcher já exclui `api/cron` desde o INC-012.5 (`443c4da`) e o endpoint responde e publica. O escopo real deste INC ficou sendo **apenas** o que a investigação revelou como faltando: **não existe nenhum agendador chamando os endpoints de cron**. Este arquivo foi reescrito com os achados reais.

## Objetivo
Fechar os dois comportamentos do núcleo jurídico reportados no teste manual de 2026-08-04: (1) editar um comunicado publicado com "mudança material" reabrir a pendência de quem já confirmou ciência — **verificado como já funcionando**; (2) comunicado agendado publicar automaticamente no horário marcado — **faltava o agendador**, entregue aqui.

## Escopo

### Parte 1 — Reabertura de pendência por mudança material (nenhuma mudança de código)

**Confirmado implementado e correto** por investigação de código e por teste manual real.

O piso de versão exigida para ack é calculado em `computeRequiredAckVersionNumber` (`src/lib/announcements/reader-state.ts`): a maior `versionNumber` com `isMaterialChange = true`, com piso 1. Quem tem ack numa versão anterior a esse piso volta a `awaitingAck`, com `wasReopened = awaitingAck && hadPriorAck`. O mesmo cálculo alimenta todas as superfícies — painel de pendências (`pending-panel.ts`: `listAnnouncementPendencySummaries`, `getAnnouncementPendencyDetail`, `getUserPendencyHistory`), lista e badge do colaborador (`list-for-user.ts`), e a cobrança (`remind-pending.ts`, que reusa `getAnnouncementPendencyDetail` em vez de recalcular quem está pendente). O aviso "este comunicado foi atualizado desde a sua última confirmação" já existe na tela de leitura (`comunicados/[id]/page.tsx:62`).

Acks antigos permanecem íntegros: a reabertura muda o **piso exigido**, não o passado — nenhum caminho de UPDATE/DELETE em `AnnouncementAck` (regra 6 do CLAUDE.md, garantida por trigger desde o INC-012.5/A4-1).

### Parte 2 — Agendamento não publica: faltava o agendador

Causa real: os handlers `/api/cron/publish-announcements` e `/api/cron/anonymize-users` são autenticados por Bearer `CRON_SECRET` e **nunca tiveram gatilho próprio** — sempre esperaram um disparador externo (está no comentário do próprio `route.ts`), e esse disparador não existia em lugar nenhum: nem cron no host, nem serviço no `docker-compose.yml`, nem `vercel.json`. O sweep (`runScheduledAnnouncementSweep`, INC-004) está correto e publica quando chamado — comprovado por HTTP real em 2026-08-04.

**O escopo é exclusivamente montar o agendador.** Nada de middleware: `api/cron` já está excluído do matcher (`src/middleware.ts` e `MIDDLEWARE_MATCHER` em `src/lib/auth/middleware-paths.ts`), e a autenticação por Bearer-secret dentro dos handlers continua sendo a única porta de entrada — não foi tocada.

Serviço `scheduler` no `docker-compose.yml` (ADR-011: VPS única com Docker Compose):
- `GET /api/cron/publish-announcements` a cada 5 minutos.
- `GET /api/cron/anonymize-users` uma vez por dia, às 03 UTC (meia-noite em America/Sao_Paulo).
- `CRON_SECRET` vem do mesmo `.env` que a app usa (interpolado pelo Compose) — o agendador não tem segredo próprio, só repassa o Bearer que o handler já exige.
- Alvo pela rede interna do Compose (`http://app:3000`), nunca `localhost` — dentro do container, `localhost` é o próprio agendador.
- **Log obrigatório**, uma linha por chamada em stdout: `<timestamp UTC> OK|FALHA GET <rota> -> <status HTTP>`. Qualquer resposta não-2xx (incluindo `000` = não conectou) sai como `FALHA`, então `docker compose logs scheduler | grep FALHA` encontra as falhas. Não é um cron mudo.

## Observação de risco (não é critério de aceite)

**Checkbox usa Base UI dentro de `<label>` sem `htmlFor`** (`admin/comunicados/[id]/form.tsx`) — mesmo padrão dos checkboxes de consentimento em `perfil/page.tsx:117,121`. Investigação anterior levantou risco de dupla ativação nesse padrão; **não reproduzido** no teste manual de hoje. Ver DP-32.

## Onde o agendador vale (e onde não vale)

O serviço `scheduler` só é relevante em ambiente com **Docker Compose** — produção/VPS, conforme ADR-011. Em **dev local** o app roda com `npm run dev`, fora do Compose, e o teste do cron continua **manual via curl** (como validado em 2026-08-04):

```
curl -i -H "Authorization: Bearer <CRON_SECRET_DO_SEU_ENV>" \
  http://localhost:3000/api/cron/publish-announcements
```

Por isso o serviço está sob o **perfil `scheduler`** e **não sobe com `docker compose up` puro**: o serviço `app` referenciado em `APP_INTERNAL_URL` ainda **não existe** neste compose (hoje ele só tem o `postgres` que serve o dev local). Sem `app`, o agendador só produziria linhas `FALHA` a cada 5 minutos. Em produção, com o serviço `app` presente no compose:

```
docker compose --profile scheduler up -d
docker compose logs -f scheduler
```

**Pendência de infraestrutura, fora deste INC:** o serviço `app` (Dockerfile + entrada no compose) é parte do ADR-011 e ainda não existe. Enquanto ele não existir, o agendador está pronto mas não tem o que chamar.

**Overrides opcionais de env** (todos têm default no compose, nenhum é obrigatório): `APP_INTERNAL_URL` (default `http://app:3000`), `SCHEDULER_PUBLISH_INTERVAL_SECONDS` (default `300`), `SCHEDULER_ANONYMIZE_AT_HOUR_UTC` (default `03`). `CRON_SECRET` já era documentado no `.env.example` desde o INC-004.

## Critérios de aceite
- [x] Publicar comunicado `requires_ack`; colaborador A confirma ciência; admin edita com "mudança material" e republica → colaborador A volta a aparecer no painel de pendências e vê o aviso de atualização + botão de ciência de novo. — **Já satisfeito antes deste INC.** Confirmado implementado e correto por investigação de código (`reader-state.ts`, `pending-panel.ts`, `list-for-user.ts`, testes de integração existentes) e por teste manual real em 2026-08-04 (Pedro): checkbox marcado → salvo → colaborador com ack anterior voltou a pendente. Nenhuma mudança de código necessária nesta parte.
- [x] Colaborador B, que nunca confirmou, continua pendente normalmente (sem regressão no caminho que já funcionava) — coberto pelos testes de integração de pendências já existentes.
- [x] `GET /api/cron/publish-announcements` com `Authorization: Bearer <CRON_SECRET>` correto publica um comunicado agendado com `publishAt` no passado — verificado via HTTP real em 2026-08-04 (`{"publishedCount":1}`).
- [x] O mesmo endpoint sem header, ou com secret errado, continua respondendo 401 — verificado via HTTP real; coberto por `route.test.ts`.
- [x] `/api/cron/anonymize-users` com o mesmo tratamento e o mesmo teste de 401 — verificado via HTTP real; coberto por `route.test.ts`.
- [ ] Serviço de agendamento no `docker-compose.yml` chamando os dois endpoints, com log grep-ável de sucesso/falha; `docker compose config` válido.
- [ ] `npm run lint && npm run typecheck && npm run test && npm run build` verdes.

## Como testar manualmente (Pedro, antes de aceitar)
1. **Reabertura de pendência** (já validado em 2026-08-04, repetir se quiser): comunicado `requires_ack` → colaborador A confirma → admin edita marcando "mudança material" → republicar. Confirmar A de volta no painel de pendências e o aviso de atualização na tela dele. Colaborador B (nunca confirmou) segue pendente, sem mudança.
2. **Agendamento em dev (manual, sem Docker):** agendar um comunicado com `publishAt` no passado e chamar
   `curl -i -H "Authorization: Bearer <CRON_SECRET_DO_SEU_ENV>" http://localhost:3000/api/cron/publish-announcements`
   → `200` com `{"publishedCount":N}`. Sem header ou com secret errado → `401`.
3. **Agendamento em produção (com Compose, quando o serviço `app` existir):** `docker compose --profile scheduler up -d`, depois `docker compose logs -f scheduler` — uma linha `OK GET /api/cron/publish-announcements -> 200` a cada 5 min. Derrubar a app e confirmar que aparece `FALHA`; `docker compose logs scheduler | grep FALHA` deve listar.

## Registro de conclusão
_(preencher)_
