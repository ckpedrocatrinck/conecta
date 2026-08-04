# Decisões Pendentes

> Nada aqui é detalhe. Cada item ou bloqueia uma fase ou muda o desenho do produto. Resolver → registrar → promover a ADR/spec → remover daqui.

> **Nota sobre a numeração (reconciliação de vault, 2026-07-16, achado A6-7 da auditoria):** a numeração salta de DP-03 para DP-05 de propósito — não existe DP-04 pendente nem a registrar; o número foi descartado/consolidado antes de virar um registro formal neste arquivo. Não é uma lacuna a preencher.

## ✅ Resolvidas em 2026-07-09

- **DP-01 — Acordo de IP com o Rede Vale Verde.** ✅ **100% aprovado pela diretoria** (produto é do Pedro; empresa é cliente-piloto). Recomendação: guardar o registro escrito dessa aprovação (e-mail/termo) junto ao projeto.
- **DP-03 — Aceite dos ADRs 001-005.** ✅ Aceitos por Pedro. Ressalva registrada no ADR-002: app nativo nas lojas é plano futuro assumido (não "talvez"), PWA é a estratégia do MVP.
- **DP-08 — Dispositivos da base.** ✅ Maioria Android, **parcela relevante de iPhone**. Consequência: risco de push no iOS elevado de marginal para material → salvaguardas adicionadas ao ADR-002 e critério de medição ao INC-012.
- **Login (contradição do kickoff).** ✅ Resolvida no **ADR-006**: login por CPF completo + senha; `cpf_hash` determinístico com pepper. "CPF parcial" eliminado do escopo.
- **Pendências de modelagem** (User desligado / AnnouncementRead). ✅ Resolvidas no **ADR-006**.

## ✅ Resolvidas em 2026-07-31

- **DP-23 — Bug de fuso horário no `datetime-local` da tela `[id]` (comunicados)
  e em Vagas.** ✅ Implementado no **INC-020**: as 3 gravações que usavam
  `new Date(valorCru)` (`scheduleAnnouncementAction` em
  `comunicados/[id]/actions.ts`; `createJobOpeningAction` em
  `vagas/novo/actions.ts`; `updateJobOpeningAction` em `vagas/[id]/actions.ts`)
  agora usam `fromDatetimeLocalSaoPaulo` (INC-018) — não só a tela `[id]` de
  comunicados citada no texto original desta DP, as 3 telas afetadas foram
  corrigidas. Provado por round-trip **através da Server Action** (não só da
  util isolada, já coberta desde o INC-018) sob `TZ=UTC` de processo — o
  cenário de produção/CI que escondia o bug.

## ✅ Resolvidas em 2026-07-24

- **DP-15 — Tela de admin para logo/cor do tenant.** ✅ Implementado no **INC-017**:
  tela "Aparência da empresa" (`/{slug}/admin/aparencia`), com upload de
  banner/logo e seletor de cor de destaque, escrita em `Tenant.logoUrl`/
  `accentColor`/`homeBannerKey` sob `requireAdmin`. **Ressalva:** a validação de
  contraste AA mencionada no texto original desta DP não foi implementada —
  registrada separadamente como **DP-22**.

## ✅ Resolvidas em 2026-07-13

- **DP-11 — Comunicado arquivado com pendência de ciência aberta absolve a pendência.** ✅ Implementado no **INC-006**: o painel de pendências (`src/lib/announcements/pending-panel.ts`, `isArchivedWithPendency`) sinaliza comunicados `requires_ack` arquivados cujo público-alvo ativo ainda não confirmou ciência — alerta destacado (vermelho) na lista e no detalhe, coberto por teste (`tests/integration/pending-panel.test.ts`). A absolvição silenciosa continua existindo para o colaborador (decisão aceita para o MVP), mas deixou de ser invisível para o RH.
- **DP-10 — Itens reais do bottom nav.** ✅ Resolvido no **ADR-009** + **INC-008.5**: bottom nav populado com Início/Comunicados/Perfil (badge de pendência reusando `countPendingAcksForUser`), header administrativo para admin (6 telas) e acesso simplificado a Pendências para manager, navegação resolvida por papel no servidor (`src/app/(app)/layout.tsx`). Vagas como 4º item continua fora de escopo, agora explicitamente adiado para o **INC-011**.

## Ainda abertas — não bloqueiam o início do desenvolvimento

**DP-02 — Nome/domínio definitivo do produto.** "Conecta" é placeholder. Impacta domínio, repo, manifest do PWA e marca. Antes de fixar: verificar **disponibilidade do domínio** (registro.br) **e da marca** (INPI). Pode rodar com o placeholder e renomear depois (custo baixo se decidido cedo), mas o nome definitivo deve estar resolvido antes do go-live do piloto (aparece no aviso de privacidade — G2/DP separado — e na marca do header). Relacionado: DP-18 (site institucional na raiz do domínio).
**Responsável:** Pedro.

**DP-05 — Dados de custo/contrato da portal legado.** Quanto o Vale Verde paga, fidelidade, quem assinou. Define teto de preço e timing da troca. Não bloqueia dev; informa a estratégia comercial.
**Responsável:** Pedro.

**DP-06 — Prazos de retenção LGPD.** Defaults (24 meses gerais; 5 anos + margem para ciência) precisam de validação jurídica **antes da venda comercial**. Para o piloto, defaults documentados bastam com ciência da controladora.
**Responsável:** Pedro + jurídico (fase comercial).

**DP-07 — Migração do histórico da portal legado.** Importar os ~450 comunicados legados (imagens) como arquivo morto ou começar do zero? Impacta INC-013. Proposta: começar do zero + legado guardado pelo RH fora do sistema.
**Responsável:** Pedro + RH do piloto.

**DP-09 — Contraste AA de `--primary`/`--action` no modo escuro.** O `design-system.md` (seção 8) pede "luminância ajustada para AA" para o verde/laranja no dark mode, mas não dá o hex resultante. O INC-003.5 implementou só os tokens neutros do escuro (fundo/superfície/texto, hex exato documentado) e reaproveitou o hex do modo claro para `--primary`/`--action` sem ajuste — dark mode "funciona" mas o contraste desses dois tokens no escuro não foi validado/ajustado. Bloqueia considerar o dark mode "pronto" (hoje é bônus, não MVP).
**Responsável:** Pedro (Claude Design define o hex ajustado quando dark mode for priorizado).

**DP-10 — Itens reais do bottom nav.** O componente `BottomNav` (INC-003.5) existe e está estilizado conforme a seção 4 do design-system, mas sem os 4–5 itens de navegação reais nem integração em nenhuma tela — o próprio design-system pede para não copiar os itens da portal legado sem revisar. Precisa de um INC de navegação (IA do app: quais telas, em que ordem, quais ícones) antes de qualquer tela usar o componente. O INC-005 (leitura/ack de comunicados) navega até `/comunicados` só pelo banner de pendência e um link na home, sem integrar o `BottomNav`, exatamente por essa decisão continuar aberta.
**Responsável:** Pedro (definir escopo do INC de navegação).

**DP-12 — Gestor multi-filial não suportado.** `User.branchId` é uma filial por usuário — não existe vínculo "gestor → várias filiais" no modelo de dados. O painel de pendências (INC-006) usa exatamente essa única filial para restringir a visão do gestor (`requireAdminOrManager` + `session.branchId`); a redação do INC-006 ("à(s) sua(s) filial(is)") é genérica, mas na prática resolve para 1 filial com o schema atual. Se um gestor cobrindo múltiplas filiais virar requisito real do piloto, é mudança de modelo de dados (tabela de vínculo gestor↔filiais) + ADR novo, não ajuste trivial no painel existente.
**Responsável:** Pedro (confirmar se é requisito real do piloto).

**DP-13 — Polimento de navegação e shell visual.** Refinamentos identificados no QA do INC-008.5 (nenhum é bug, são melhorias sobre a fundação de navegação do ADR-009): (1) header admin hoje é uma fileira de links de texto — melhorar hierarquia visual, indicar a seção ativa, dar aos itens um carinho equivalente ao bottom nav (ícones); (2) identidade do usuário logado + logout acessível no header — o botão "Sair" saiu da home na limpeza de links soltos do INC-008.5 e ainda não tem um lugar novo; (3) "voltar ao início" pouco óbvio para o admin (hoje só via bottom nav, que ele pode nem estar olhando no fluxo de desktop); (4) avaliar se o bottom nav deve sumir em viewport desktop (é um padrão mobile, pode ficar deslocado em tela larga); (5) política de senha (ver DP separada, se registrada). Agendado para rodar entre o INC-012 e o INC-013.
**Responsável:** Pedro (priorizar no calendário entre INC-012/013).

**DP-14 — Redesenho visual completo com Claude Design.** Fazer uma única passada de reformulação visual de todas as telas de uma vez, enviando print de cada tela ao Claude Design para ter contexto completo e manter consistência (em vez de retrabalhar tela a tela). Ressalva 1: é elevação do design-system Balcão, não substituição — preservar os princípios funcionais (verde como base, laranja só para ação, Figtree, mobile-first); se o Claude Design propuser abandonar esses princípios, recusar, pois servem à tese do produto, não são só estética. Ressalva 2: fazer antes do INC-013 (hardening), nunca depois — o hardening precisa testar o produto já com o visual final, senão gera retrabalho de QA. Resultado alimenta atualização de `docs/06-Design/design-system.md`. Agendado para rodar entre o INC-012 e o INC-013 (mesma janela do DP-13; considerar se dá pra fazer em conjunto).
**Responsável:** Pedro + Claude Design.

**DP-16 — Notificação (in-app + push) para comunicado crítico publicado e marcação em post.** O INC-012 reduziu escopo (2026-07-14, decisão de Pedro) para push cobrir só o gatilho de cobrança de pendência — o único que já dispara notificação hoje, via `NotificationChannel` (INC-007). Os outros dois eventos do escopo original do INC-012 não têm hoje nenhum gatilho de notificação, nem in-app: (a) comunicado `requires_ack`/crítico publicado notificando o público-alvo, e (b) usuário marcado (`PostPerson`) num post. Implementá-los exige decidir antes: fan-out síncrono vs. assíncrono do publish para potencialmente todo o público-alvo do tenant (sem worker dedicado — ver `stack.md`/ADR-002), e o momento exato do disparo da marcação em post (na criação? só quando o post é publicado? só para `type=recognition`?). Vira INC próprio depois do INC-012, com essas decisões resolvidas antes — provavelmente ADR novo, dado o impacto de fan-out sem infraestrutura de filas.
**Responsável:** Pedro (priorizar quando decidir avançar com os outros gatilhos).

**DP-17 — Envio de push acoplado à transação da cobrança (escala).** O INC-012 implementou `PushNotificationChannel.send(tx, input)` fazendo a chamada de rede (VAPID/Web Push) **dentro** da mesma transação Prisma de `remindPendingUsers` — exigência do contrato `NotificationChannel.send(tx, input)` do INC-007, que o INC-012 não altera. Aceito conscientemente para o piloto (poucos pendentes por cobrança, erros de rede são capturados dentro do canal e nunca abortam a transação). **Se o produto escalar** (cobranças com centenas/milhares de pendentes), isso vira gargalo real: uma transação de banco mantida aberta por N chamadas de rede sequenciais. Nesse cenário, desacoplar o envio de push da transação (ex.: gravar a intenção de notificar dentro da transação e enviar de fato fora dela) passa a ser necessário — hoje é dívida controlada, não um bug.
**Responsável:** Pedro (reavaliar quando o volume de pendentes por cobrança crescer).

**DP-22 — Cor de destaque do tenant sem validação de contraste AA.** A tela "Aparência da empresa" (INC-017) valida a cor de destaque (`Tenant.accentColor`) só pelo formato hex `#RRGGBB` (`updateAccentColorAction`, regex `HEX_COLOR`) — não há cálculo de contraste contra `--background`/`--card`, embora a DP-15 original (resolvida no INC-017) pedisse essa validação. Um tenant pode hoje escolher uma cor que quebra a legibilidade nos cards gerados. Achado no levantamento read-only que precedeu o INC-019 (banner por seção). Só registro — não implementar sem decisão explícita (ex.: qual fórmula de contraste, bloquear salvar vs. avisar).
**Responsável:** Pedro (priorizar quando decidir).

**DP-18 — Site institucional (raiz do domínio, ex.: `conecta.com.br`).** Página de marketing/institucional na raiz do domínio, **separada** do app (o app fica em subdomínio/rota própria). **Decisão de escopo: é projeto SEPARADO e pós-piloto** — não faz parte do produto Conecta nem de nenhum INC atual; registrado aqui só para não se perder. Depende de DP-02 (nome/domínio definitivo).
**Responsável:** Pedro (pós-piloto).

**DP-19 — Auto-rascunho é solução TEMPORÁRIA para anexos "postar com tudo junto" (INC-016).** Para o admin anexar imagem/PDF na mesma tela em que escreve o post, o "Novo post" cria/reaproveita um rascunho automaticamente e leva direto à tela de compor — porque a chave do storage do anexo (`posts/{tenant}/{postId}/…`) precisa do `postId`, que só existe depois do rascunho nascer. O tratamento de órfãos atual (reusar 1 rascunho pristine por admin + apagar extras + não listar pristine + guard de publicação) resolve o custo de escala **sem sweep e sem R2** (é 100% DB), mas o modelo continua sendo "criar linha antes de ter conteúdo". A **solução limpa é staging por sessão**: o upload vai para uma área temporária (`_staging/{sessão}/…`) e é *rekeyada* para o post no momento do salvar — assim nenhum rascunho nasce só para hospedar anexo. Ela **depende do R2 real**, porque rekeyar = **mover objetos no storage** (copy+delete / rename de chave), operação que o mock local de disco não expõe de forma production-safe. **Quitar quando o R2 for ativado**, junto do **conjunto de dívidas do R2**: orphan-sweep de objetos não-confirmados, `delete(key)` na anonimização (INC-013 G1), logos de benefício (INC-015 fase 2) e o banner (INC-017). Ver `docs/04-Roadmap/incrementos/INC-016-anexos-no-feed.md`.
**Responsável:** Pedro (quitar na ativação do R2).

**DP-20 — 🔴 BLOQUEADOR DE DEPLOY: `npm run build` está quebrado (vazamento de módulo servidor→cliente).** `next build` falha com `the chunking context (unknown) does not support external modules (request: node:fs/promises)`. Causa: `src/lib/birthdays/build-birthday-view.ts` é um **módulo misto** — carrega a lógica de servidor (`buildBirthdayListView`, `buildTodaysBirthdayCards`, que importam `mediaStorage` → `local-media-fs` → `node:fs/promises`) **e** o helper puro de apresentação `birthdayDayLabel` (linha 54). O client component `src/components/birthdays/birthday-search.tsx` (`"use client"`) importa `birthdayDayLabel` — um **valor** de runtime, não só tipo — então o grafo inteiro do módulo entra no chunk do cliente, arrastando `node:fs/promises`. Latente desde o **INC-010** (`c68346f`, que introduziu os dois lados no mesmo commit): o Next é 16.2.10 desde o primeiro commit, então o build com Turbopack sempre teria falhado — ninguém percebeu porque **o CI nunca rodou `build`** (o workflow termina em `npm run test`) e `next dev` compila por rota sob demanda, sem o passe de chunking de produção. **Correção em duas partes, na ordem:** (1) extrair `birthdayDayLabel` + o tipo `BirthdayListEntry` para um módulo puro (sem import de storage), deixando `build-birthday-view.ts` server-only; (2) **só então** adicionar `npm run build` ao `.github/workflows/ci.yml` — inverter a ordem deixa a `main` vermelha. Mesmo espírito do detector de drift de GRANTs: fazer o CI acusar a categoria que hoje só aparece no deploy. **Vira INC próprio.**
**Responsável:** Pedro (abrir o INC) — bloqueia qualquer deploy até ser quitado.

**DP-21 — `package-lock.json` gerado no Windows quebra o `npm ci` do CI (dependências opcionais multiplataforma).** Qualquer `npm install` rodado na máquina Windows do dev **poda** as entradas top-level `@emnapi/core@1.11.2` e `@emnapi/runtime@1.11.2` do lock — entradas exigidas pelo bloco `overrides` do `package.json` e necessárias no Linux, onde o npm instala o fallback wasm `@tailwindcss/oxide-wasm32-wasi`. O `npm ci` do CI então falha com `Missing: @emnapi/runtime@1.11.2 from lock file` **antes de rodar qualquer teste**. Reproduzido: foi exatamente assim que a branch `hardening/deps-cve` nasceu vermelha (`9d56cbc`). Os flags `--os=linux --cpu=x64 --libc=glibc` **não** resolvem; `npm install --package-lock-only` também poda. **Workaround verificado:** gerar o lock num container Linux — `docker run --rm -v <dir>:/app -w /app node:22 npm install --package-lock-only` — que restaura as entradas e produz um diff mínimo. **Decisão pendente:** adotar esse comando como procedimento oficial de mexer em dependência (documentar em `convencoes-git.md`/`infra-banco-dev-e-ci.md`), ou remover os `overrides` de `@emnapi/*` se eles não forem mais necessários (entraram por CVE transitiva — reavaliar).
**Responsável:** Pedro (decidir o procedimento).

**DP-24 — Público-alvo (`branchIds`) de comunicado não validado contra o tenant da sessão.** Identificado durante o INC-018 (2026-07-27), pré-existente (não introduzido por ele) — reportado como follow-up, não corrigido. `replaceAnnouncementAudience` (`announcement-audience.repository.ts`) grava os `branchIds` recebidos do formulário direto, sem confirmar que cada `branchId` pertence ao tenant da sessão. Como a linha de `AnnouncementAudience` é gravada com o `tenantId` correto do comunicado, isso **não vaza dado entre tenants** (RLS continua isolando a leitura) — mas um `branchId` de outro tenant (ou inexistente) cria uma audiência que não corresponde a nenhuma filial real, restringindo o público a zero pessoas silenciosamente, sem erro. Correção: validar `branchIds` contra `findBranchesByTenant(tenantId)` antes de gravar.
**Responsável:** Pedro (priorizar — mesma classe de bug de outros achados de validação de tenant, mesmo sem vazamento).

**DP-25 — `pending-panel-performance.test.ts` cada vez mais perto do orçamento de 1s (risco de flakiness).** O teste de performance do painel de pendências (500 usuários × 100 comunicados) tem orçamento fixo de 1s; o INC-018 acrescentou 2 arquivos de teste de integração novos rodando em paralelo na mesma suíte, e o teste já correu mais perto do limite do que antes (registrado no relatório de entrega do INC-018, 2026-07-27). Mesma causa-raiz da flakiness de contenção paralela já documentada em outros INCs (INC-017, INC-019) — orçamento fixo de tempo é sensível à carga concorrente da máquina/CI, não ao código em si. Ainda não falhou de verdade, mas a margem está encolhendo a cada suíte nova.
**Responsável:** Pedro (decidir: subir o orçamento, isolar o teste de performance dos demais, ou medir de outra forma que não dependa de tempo de parede).

**DP-26 — Banners de seção: migrar de coluna fixa para coleção (carousel na Home).** O INC-019 modelou banner por seção como coluna fixa no `Tenant` (1 URL por seção — hoje vagas/benefícios e a Home). Pedro propôs permitir até 3 banners na Home com rotação automática. Colunas fixas (`bannerInicio1Url`, `bannerInicio2Url`, `bannerInicio3Url`) não escalam — sem ordenação, ativação/inativação ou vigência sem nova migration a cada limite alterado. Decisão proposta: extrair para tabela `Banner` (`tenant_id`, `section`, `image_url`, `link_url?`, `sort_order`, `active`, `created_at`), servindo início/vagas/benefícios com o mesmo primitivo — evita repetir a fragmentação já identificada no caso do upload. Pontos a decidir antes do INC: (1) se a migração cobre as 3 seções agora ou só início, deixando vagas/benefícios na coluna fixa até precisarem de N>1; (2) comportamento do carousel — intervalo de auto-advance, pausa ao toque/arraste, respeito a `prefers-reduced-motion` (design-system.md §7, já é requisito, não é novo); (3) carregamento das imagens não-ativas (lazy, sem travar o LCP da Home, dado o perfil de rede ruim do colaborador — ver M6 da auditoria de usabilidade); (4) UI de admin para gerenciar a lista (upload, reordenar, ativar/desativar) — hoje banner único é configurado direto no banco (mesma situação da DP-15 de logo/cor).
**Responsável:** Pedro (confirmar escopo — só início ou as 3 seções — antes de abrir o INC).

---

## Bloqueadores e dependências do go-live do piloto (INC-013)

> Itens do hardening que **não são código** — dependem de input do Pedro (jurídico) ou de verificação em painel (host/Neon/Vercel). Rastreados em detalhe na auditoria (`docs/00-Processo/auditoria-conformidade-lgpd-2026-07.md`) e no INC (`docs/04-Roadmap/incrementos/INC-013-hardening-piloto.md`); consolidados aqui para não se perderem. **Os 🔴 bloqueiam a entrada de dado real de pessoa no piloto.**

**G2 — Aviso de privacidade definitivo.** 🔴 Substituir o placeholder (`src/lib/privacy/notice.ts`), bumpar `PRIVACY_NOTICE_VERSION` e **declarar transferência internacional** (LGPD Art. 33) se a infra rodar fora do Brasil. **Travado em:** (a) texto jurídico do Pedro; (b) M3 (região da infra). Os drafts (`aviso-privacidade.md`, `guia-conformidade-lgpd.md`) estão **untracked** na árvore de trabalho e vão para `docs/03-LGPD/` (não `04-Roadmap/`) quando preenchidos, commitados junto do G2. O código do G2 em si é pequeno.
**Responsável:** Pedro + jurídico.

**G3 — Execução do teste de restore de backup.** 🔴 **Bloqueia go-live.** O runbook + template de evidência estão prontos (`docs/00-Processo/runbook-teste-de-restore.md`). **Travado em:** (a) M2 (confirmar backup ativo/cifrado no Neon); (b) executar o teste e anexar a evidência no vault (critério de aceite do INC-013).
**Responsável:** Pedro (executar seguindo o runbook).

**M1 — HTTPS forçado no domínio de produção.** 🔴 Verificação no painel do host.
**Responsável:** Pedro.

**M2 — Backups automáticos ativos e cifrados.** 🔴 Verificação no painel do Neon. Pré-requisito do G3.
**Responsável:** Pedro.

**M3 — Região da infra (Neon + Vercel).** 🔴 Confirmar se roda fora do Brasil → alimenta a declaração de transferência internacional do G2 (Art. 33).
**Responsável:** Pedro.

---

## Situação para começar a codar

Todos os bloqueios das Fases 0 e 1 estão resolvidos. Os 6 ADRs estão Aceitos.
**O projeto está liberado para `/inc 001`.**
