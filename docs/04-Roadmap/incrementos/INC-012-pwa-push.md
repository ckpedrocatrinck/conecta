# INC-012 — PWA completo: manifest, offline, Web Push

**Status:** ⬜ Não iniciado
**Fase:** 4
**Depende de:** INC-005 (cobranças), INC-007 (canal de notificação)
**ADRs relevantes:** 002

## Objetivo
App instalável na home do celular com push funcionando — o mecanismo de retorno diário.

## Escopo
1. Manifest completo (ícones, cores do tenant se viável, standalone) + prompt de instalação contextual (não intrusivo, após primeiro uso bem-sucedido).
2. Service worker: cache de shell + leitura offline das últimas telas visitadas (feed, comunicados já abertos); banner de "sem conexão" honesto.
3. Web Push (VAPID): opt-in claro em pt-BR, gerenciamento de subscriptions por dispositivo, revogação no perfil.
4. Eventos que disparam push: comunicado crítico publicado, cobrança de pendência, post em que fui marcado. Preferências simples por usuário.
5. Documentar limitações iOS no vault (`02-Arquitetura/`) com o que foi medido em teste real.

## Critérios de aceite
- [ ] Lighthouse PWA instalável sem erros.
- [ ] Push recebido em Android real (Chrome) com app fechado.
- [ ] **Push testado em iPhone real (iOS 16.4+, PWA instalado) e taxa de entrega registrada no vault** (ADR-006/ADR-002: base tem parcela relevante de iOS — medir, não presumir). Se a entrega for ruim, registrar como gatilho do plano B (WhatsApp) sem implementá-lo neste INC.
- [ ] Mensagem de erro em pt-BR quando permissão negada (anti-padrão portal legado: "Notifications are denied by the user").
- [ ] Revogar push no perfil interrompe envios de verdade.

## Registro de conclusão
_(preencher)_
