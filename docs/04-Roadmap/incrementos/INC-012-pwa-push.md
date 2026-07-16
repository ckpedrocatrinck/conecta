# INC-012 — PWA completo: manifest, offline, Web Push

**Status:** 🟡 Código completo (branch `inc-012-pwa-push`, não mergeada) — **não concluído**: falta a medição real de push em iPhone (ver critério de aceite abaixo e `docs/02-Arquitetura/pwa-push-ios.md`)
**Fase:** 4
**Depende de:** INC-005 (cobranças), INC-007 (canal de notificação)
**ADRs relevantes:** 002

> **Nota de escopo (2026-07-14, decisão de Pedro):** o escopo original do item
> 4 previa push para três eventos, mas só "cobrança de pendência" já tem
> gatilho de notificação hoje (`NotificationChannel`, INC-007) — "comunicado
> crítico publicado" e "post em que fui marcado" não disparam nenhuma
> notificação (nem in-app) no código atual, e construir isso envolve decisões
> de arquitetura não tomadas (fan-out do publish, momento exato do disparo).
> Escopo reduzido para isolar a variável central do INC (push funciona no
> iPhone?). Os dois eventos removidos ficam registrados como **DP-16** em
> `docs/05-Decisoes-Pendentes.md`, para virar INC próprio depois.

## Objetivo
App instalável na home do celular com push funcionando — o mecanismo de retorno diário.

## Escopo
1. Manifest completo (ícones, cores do tenant se viável, standalone) + prompt de instalação contextual (não intrusivo, após primeiro uso bem-sucedido).
2. Service worker: cache de shell + leitura offline das últimas telas visitadas (feed, comunicados já abertos); banner de "sem conexão" honesto.
3. Web Push (VAPID): opt-in claro em pt-BR, gerenciamento de subscriptions por dispositivo, revogação no perfil.
4. Evento que dispara push: cobrança de pendência (único gatilho de notificação que já existe hoje, via `NotificationChannel`/INC-007) — o `PushNotificationChannel` novo se combina ao `InAppNotificationChannel` existente em `remindPendingUsers`, sem alterar lógica de domínio. Preferências simples por usuário. Os gatilhos de "comunicado crítico publicado" e "post em que fui marcado" saem do escopo deste INC (ver nota acima / DP-16).
5. Documentar limitações iOS no vault (`02-Arquitetura/`) com o que foi medido em teste real.

## Critérios de aceite
- [ ] Lighthouse PWA instalável sem erros.
- [ ] Push recebido em Android real (Chrome) com app fechado.
- [ ] **Push testado em iPhone real (iOS 16.4+, PWA instalado) e taxa de entrega registrada no vault** (ADR-006/ADR-002: base tem parcela relevante de iOS — medir, não presumir). Se a entrega for ruim, registrar como gatilho do plano B (WhatsApp) sem implementá-lo neste INC.
- [ ] Mensagem de erro em pt-BR quando permissão negada (anti-padrão portal legado: "Notifications are denied by the user").
- [ ] Revogar push no perfil interrompe envios de verdade.

## Registro de conclusão
_(preencher — só ao fechar. Este INC não fecha com a medição de push em iPhone pendente, mesmo que o resto do código esteja completo. Ver `docs/02-Arquitetura/pwa-push-ios.md`.)_

**Situação em 2026-07-16 (reconciliação de vault, achado A6-4 da auditoria):** código implementado na branch `inc-012-pwa-push` (commits `94e69cd`, `43085b9`, `b2302a1`, `46a0122`), ainda não mergeada na main. A tabela de medição real de push em iPhone (`docs/02-Arquitetura/pwa-push-ios.md`) não existia no vault até esta reconciliação — foi criada agora, vazia, para não perder o requisito. Seja honesto: este INC só fecha quando essa tabela estiver preenchida com dados reais.
