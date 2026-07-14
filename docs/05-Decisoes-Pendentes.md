# Decisões Pendentes

> Nada aqui é detalhe. Cada item ou bloqueia uma fase ou muda o desenho do produto. Resolver → registrar → promover a ADR/spec → remover daqui.

## ✅ Resolvidas em 2026-07-09

- **DP-01 — Acordo de IP com o Rede Vale Verde.** ✅ **100% aprovado pela diretoria** (produto é do Pedro; empresa é cliente-piloto). Recomendação: guardar o registro escrito dessa aprovação (e-mail/termo) junto ao projeto.
- **DP-03 — Aceite dos ADRs 001-005.** ✅ Aceitos por Pedro. Ressalva registrada no ADR-002: app nativo nas lojas é plano futuro assumido (não "talvez"), PWA é a estratégia do MVP.
- **DP-08 — Dispositivos da base.** ✅ Maioria Android, **parcela relevante de iPhone**. Consequência: risco de push no iOS elevado de marginal para material → salvaguardas adicionadas ao ADR-002 e critério de medição ao INC-012.
- **Login (contradição do kickoff).** ✅ Resolvida no **ADR-006**: login por CPF completo + senha; `cpf_hash` determinístico com pepper. "CPF parcial" eliminado do escopo.
- **Pendências de modelagem** (User desligado / AnnouncementRead). ✅ Resolvidas no **ADR-006**.

## ✅ Resolvidas em 2026-07-13

- **DP-11 — Comunicado arquivado com pendência de ciência aberta absolve a pendência.** ✅ Implementado no **INC-006**: o painel de pendências (`src/lib/announcements/pending-panel.ts`, `isArchivedWithPendency`) sinaliza comunicados `requires_ack` arquivados cujo público-alvo ativo ainda não confirmou ciência — alerta destacado (vermelho) na lista e no detalhe, coberto por teste (`tests/integration/pending-panel.test.ts`). A absolvição silenciosa continua existindo para o colaborador (decisão aceita para o MVP), mas deixou de ser invisível para o RH.
- **DP-10 — Itens reais do bottom nav.** ✅ Resolvido no **ADR-009** + **INC-008.5**: bottom nav populado com Início/Comunicados/Perfil (badge de pendência reusando `countPendingAcksForUser`), header administrativo para admin (6 telas) e acesso simplificado a Pendências para manager, navegação resolvida por papel no servidor (`src/app/(app)/layout.tsx`). Vagas como 4º item continua fora de escopo, agora explicitamente adiado para o **INC-011**.

## Ainda abertas — não bloqueiam o início do desenvolvimento

**DP-02 — Nome do produto.** "Conecta" é placeholder. Impacta domínio, repo, manifest do PWA e marca. Verificar disponibilidade no INPI antes de fixar. Pode rodar INC-001 com o placeholder e renomear depois (custo baixo se decidido cedo).
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

**DP-15 — Tela de admin para logo/cor do tenant.** O INC-009 adicionou `Tenant.logoUrl`/`Tenant.accentColor` ao schema, mas sem UI para editar — no piloto, configurado direto no banco. Antes da fase comercial (onboarding de novos clientes sem acesso ao banco), precisa de uma tela de admin (provavelmente super-admin, não o admin de tenant) para upload de logo + escolha da cor de destaque, com validação de contraste AA contra `--background`/`--card` (o design-system exige AA em toda combinação texto/fundo nova).
**Responsável:** Pedro (priorizar quando o segundo cliente entrar).

---

## Situação para começar a codar

Todos os bloqueios das Fases 0 e 1 estão resolvidos. Os 6 ADRs estão Aceitos.
**O projeto está liberado para `/inc 001`.**
