# INC-018 — Comunicados: publicar/agendar direto na tela de criação

**Status:** 📝 Especificado (aguardando execução)
**Fase:** 2 — Núcleo jurídico
**Depende de:** INC-004 (CRUD + versionamento + publish/schedule/cron), INC-005 (fuso America/Sao_Paulo)
**ADRs relevantes:** 001
**Branch:** `inc-018-comunicado-acoes-na-criacao`

> Confirmar antes de começar que `018` é o próximo número livre — INC-014 a 017 já foram concluídos; este é o próximo na sequência.

## Objetivo

Na tela de criação (`/admin/comunicados/novo`), o admin escolhe o destino do comunicado **no momento de criar**: salvar rascunho, publicar agora ou agendar. Hoje a tela só cria rascunho e as ações de publicar/agendar vivem em `/admin/comunicados/[id]` — o admin é obrigado a um segundo passo para publicar. Esta é uma mudança de **composição de UI + Server Action**, não de máquina de publicação: toda a lógica já existe no INC-004.

## Fora de escopo (explícito)

- **Imagem/anexo no comunicado.** Reafirmada a decisão de Pedro (INC-004, 2026-07-10): o núcleo é texto versionado + ciência; anexo em comunicado é decisão de evidência-vs-enfeite que exige ADR próprio e R2 real, não entra aqui.
- **Tela `/admin/comunicados/[id]`.** As ações de lá (publicar/agendar/cancelar/arquivar, checkbox de "mudança material") continuam como estão. Este INC não as toca.
- **Cron de agendamento.** `runScheduledAnnouncementSweep` + `GET /api/cron/publish-announcements` já existem (INC-004). Não há código novo de cron aqui. **Verificação operacional de Pedro:** confirmar que o disparo periódico está configurado em produção (Vercel Cron batendo no endpoint com `CRON_SECRET`) — senão "Agendar" grava um `scheduled` que nunca publica.
- **Notificação de publicação** (DP-16) — fora.

## Escopo

1. **Três ações na tela `novo`**, sobre o mesmo formulário atual (título, corpo Tiptap, categoria, criticidade, público-alvo — a tela já coleta tudo que a publicação precisa):
   - **Salvar rascunho** — comportamento atual (`createAnnouncementDraft`), inalterado.
   - **Publicar agora** — cria o comunicado + primeira versão e publica no mesmo passo.
   - **Agendar** — cria o comunicado + primeira versão em estado `scheduled`, com `publish_at` informado pelo admin.

2. **Reuso, não reimplementação.** As ações compostas usam os primitivos existentes do INC-004: `createAnnouncementDraft`, `publishAnnouncement()` (`src/lib/announcements/publish.ts`), `scheduleAnnouncementPublication()`. **Nenhuma função de repositório nova, nenhuma lógica de publicação nova.** Se a implementação parecer exigir reescrever `publish.ts` ou o contador de sequência, PARE e reporte (regra 2 do fluxo) — provavelmente é sinal de que a composição está errada, não de que falta código.

3. **Invariante "sem rascunho órfão".** "Publicar agora" não pode deixar um rascunho pendurado se a publicação falhar. Duas implementações aceitáveis, **preferindo a primeira**:
   - (preferida) `createAnnouncementDraft` + `publishAnnouncement` numa **única transação Prisma**, preservando a aquisição atômica de `seq_number` (`INSERT ... ON CONFLICT`) e o `count`-check do UPDATE final que já existe no `publish.ts`.
   - (fallback) dois passos sequenciais commitados, onde uma falha na publicação deixa um **rascunho válido e re-publicável** (não um estado corrompido).
   - Claude Code deve **reportar qual das duas usou e por quê** — em especial se a assinatura atual de `publishAnnouncement` não aceitar uma transação externa e por isso a opção 1 não compôs limpo.

4. **Validação server-side nos caminhos de publicar/agendar.** Título e corpo obrigatórios (verificados **depois** da sanitização server-side, nunca confiando no cliente); público-alvo resolvido. Rascunho continua tolerante como hoje (pode salvar incompleto).

5. **Agendar — `publish_at`.** Obrigatório e **no futuro** (validação server-side; rejeitar data/hora no passado com mensagem clara). UI em America/Sao_Paulo, persistência em UTC — mesmo tratamento de fuso do INC-005. Não reaproveitar a semântica "passado = publica no próximo sweep" do teste do INC-004: aqui, passado é erro do usuário.

6. **Trava de confirmação deliberada.** "Publicar agora" e "Agendar" exigem um passo de confirmação que declara as consequências antes de efetivar:
   - publicar gera um número `CI NN/AAAA` **permanente**;
   - se `criticality = requires_ack`, abre **pendência de ciência para todo o público-alvo**;
   - agendar mostra a data/hora resolvida que será publicada.
   "Salvar rascunho" **não** tem confirmação. Racional: o fluxo rascunho-primeiro de hoje funcionava como trava acidental de dois passos contra publicação por engano; ao colapsar em um clique, essa trava vira proposital, não desaparece. Para o núcleo de prova, publicar por engano é caro.

7. **Navegação pós-ação.** Reusar o padrão `?ok=` existente. Rascunho → `[id]` (como hoje). Publicar → `[id]` mostrando o `CI NN/AAAA`. Agendar → `[id]` mostrando `scheduled` + `publish_at`.

8. **Checkbox "mudança material":** N/A na tela `novo`. Só existe para edição de comunicado já publicado (INC-004) — primeira publicação nunca é mudança material.

## GRANTs / matriz de permissões

Nenhuma tabela nova, nenhum verbo de escrita novo: `announcements` já tem `S I U`, `announcement_versions` já tem `S I`, `announcement_sequences` já tem `S I U`. A matriz `EXPECTED` (detector de drift, quando existir) **não muda** com este INC. Registrar isso no relatório é suficiente; não há migration de GRANT aqui.

## Critérios de aceite

- [ ] **Publicar agora, a partir de `novo`:** o comunicado nasce `published` com `CI NN/AAAA` real (número da sequência do tenant/ano), exatamente **uma** versão, sem passar pela tela `[id]`. Teste de integração cobrindo o caminho composto.
- [ ] **Agendar, a partir de `novo`:** o comunicado nasce `scheduled` com `publish_at` gravado em UTC, **sem** número ainda; rodar `runScheduledAnnouncementSweep` (ou o endpoint) publica com o próximo número. Teste de integração.
- [ ] **Salvar rascunho:** comportamento **inalterado** — sem número, uma versão, `seq_number`/`year` nulos. Teste de não-regressão.
- [ ] **Publicar/agendar com título ou corpo vazio (pós-sanitização):** rejeitado com mensagem; **nada** é criado no banco. Teste.
- [ ] **Agendar com data/hora no passado:** rejeitado com mensagem; nada é criado. Teste.
- [ ] **Sem rascunho órfão:** simular falha na publicação após a criação → não sobra comunicado em estado inválido (transação) ou sobra um rascunho válido re-publicável (fallback). Teste do caminho de erro.
- [ ] **Concorrência:** dois admins publicando comunicados **novos** simultaneamente recebem números distintos (reusa o contador atômico do INC-004 pelo novo caminho). Teste, ainda que leve.
- [ ] **Confirmação:** "Publicar agora" e "Agendar" passam por um passo de confirmação que enuncia as consequências; "Salvar rascunho" não. Verificação manual (+ teste de componente se o padrão do projeto permitir).
- [ ] `npm run lint && npm run typecheck && npm run test` verdes.

## Arquivos afetados (estimativa — Claude Code confirma na leitura)

- `src/app/(app)/admin/comunicados/novo/` — reshape do formulário: três ações + diálogo de confirmação + campo de `publish_at` para agendar.
- Server Action(s) composta(s) create+publish / create+schedule — onde as actions da rota vivem, ou `src/lib/announcements/`.
- `src/lib/announcements/publish.ts`, `announcement.repository.ts` — **reuso apenas**, idealmente sem alteração (ver escopo item 3).
- Componente de confirmação — reusar shadcn/ui do INC-003.5 se já houver diálogo; senão seguir o design-system.
- `tests/integration/announcement-publishing.test.ts` — estender, ou arquivo novo para o caminho create→publish/schedule a partir da criação.

## Registro de conclusão

- **Concluído em:** 2026-07-27
- **Branch:** `inc-018-comunicado-acoes-na-criacao`
- **Migrações:** nenhuma. Sem tabela nova e sem verbo de escrita novo — a matriz
  `EXPECTED` do detector de drift de GRANTs não mudou (`grants-matrix.test.ts`
  verde sem edição).
- **Invariante "sem rascunho órfão" (item 3):** implementada pela opção
  **preferida** — `createAnnouncementDraft` + `publishAnnouncement` numa
  **transação Prisma única**. Compôs sem fallback porque `publishAnnouncement()`
  já recebia um `Prisma.TransactionClient` externo e `withTenant()` já é uma
  transação: `git diff main -- src/lib/announcements/publish.ts
  src/lib/repositories/announcement-sequence.repository.ts` é **vazio**.
- **Testes:** suíte verde, 271 → **292 testes** (53 → 55 arquivos). Novos: a
  composição create+publish/schedule contra o banco real, incluindo os dois
  caminhos de rollback do "sem rascunho órfão" e concorrência de comunicados
  novos (`announcement-create-and-publish.test.ts`); as Server Actions
  ponta-a-ponta com validação pós-sanitização e rejeição de data no passado, com
  contagem antes/depois provando que **nada** é criado
  (`announcement-create-actions.test.ts`); `fromDatetimeLocalSaoPaulo`
  (`format-datetime.test.ts`).
- **Sem teste de componente para a trava de confirmação:** o projeto não tem
  jsdom/testing-library e o DP-21 impede instalar dependência na máquina de dev.
  A confirmação foi validada manualmente; as Server Actions por baixo dela estão
  cobertas.
- **Dívidas registradas no relatório de entrega:** bug de fuso no
  `datetime-local` da tela `[id]` e em `vagas` (`new Date(valor)` grava 3h
  adiantado em runtime UTC — fora do escopo deste INC, candidato a DP); público-
  alvo não validado contra o tenant (exposição pré-existente, sem vazamento
  entre tenants); `pending-panel-performance.test.ts` mais perto do orçamento de
  1s com a carga dos 2 arquivos novos.
- **Pendência operacional (não-código):** confirmar o Vercel Cron batendo em
  `GET /api/cron/publish-announcements` com `CRON_SECRET` em produção — sem
  isso, "Agendar" grava um `scheduled` que nunca publica.
