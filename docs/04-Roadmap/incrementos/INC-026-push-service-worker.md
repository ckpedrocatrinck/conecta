# INC-026 — Handler de push no service worker

**Status:** 🟡 Código completo (2026-08-06) — **aguarda o teste do Pedro no iPhone real**. Os
critérios (a) e (b) só podem ser verificados no device; nenhum push de teste foi disparado sem
autorização.
**Fase:** correção (pré-piloto)
**Origem:** investigação de 2026-08-06 — o primeiro teste real de push em iPhone
**Depende de:** INC-012 (metade servidor do push), INC-025 (app no Compose, onde o teste rodou)

## Objetivo

Fechar a lacuna que mantém o **INC-012 em 🟡**: a medição real de push em iPhone nunca pôde ser
feita porque **o handler de `push` nunca existiu no cliente**.

O INC-012 entregou a metade servidor completa e correta — VAPID, `PushNotificationChannel`,
opt-in, revogação. Não entregou a metade que **exibe** a notificação. Verificado em 2026-08-06 por
diagnóstico ponta a ponta contra o iPhone do Pedro:

| Etapa | Resultado |
|---|---|
| `pushManager.subscribe()` no device | ✅ inscrição criada, endpoint `web.push.apple.com`, chaves íntegras |
| Servidor cifra e envia (`webpush.sendNotification`) | ✅ **`201 Created`** com `apns-id` |
| iPhone acorda o service worker | ✅ |
| Evento `push` chega | ❌ **nenhum listener** → nada é exibido |

`showNotification` não aparece em nenhum arquivo do repo. `public/sw.js` tem `install`, `activate`
e `fetch` — só isso. Não é regressão: nunca funcionou.

**Agravante do contrato `userVisibleOnly: true`.** A inscrição foi criada com essa flag, que é um
compromisso: todo push recebido **tem** que gerar notificação visível. Receber push e não exibir
nada é violação — o navegador pune a origem e, no Safari, pode **revogar a inscrição sozinho**. Ou
seja, a ausência do handler não é só "não aparece": ela corrói a própria inscrição.

## Escopo

1. **`public/sw.js`** — `push` e `notificationclick`.
2. **`src/lib/notifications/push-channel.ts`** — o `catch` que hoje descarta tudo (exceto 404/410)
   passa a logar `statusCode` + mensagem. **Só logging:** não abortar a transação continua valendo
   (DP-17, decisão aceita, não reaberta aqui).

Fora de escopo: qualquer mudança no gatilho de push (segue só "cobrança de pendência", INC-012 item
4), nos gatilhos adiados da DP-16, e na arquitetura de envio dentro da transação (DP-17).

## Critérios de aceite

- [ ] **(a)** Push exibe **notificação visível** no iPhone real com o app **fechado/bloqueado** —
      não só com o PWA aberto em primeiro plano.
- [ ] **(b)** Clique na notificação **abre ou foca** o app na tela relevante (destino definido na
      Tarefa 1 deste INC); se já houver janela aberta, foca em vez de abrir uma segunda.
- [ ] **(c)** Falha real de envio **loga algo** no servidor — `statusCode` e mensagem do erro — em
      vez de desaparecer no catch mudo.
- [x] Parse do payload que falhar **ainda assim** exibe notificação genérica (contrato
      `userVisibleOnly`), nunca pula o `showNotification`.
- [x] `npm run lint && npm run typecheck && npm run test && npm run build` verdes.

> **O INC-012 só sai de 🟡 depois** do teste do Pedro no device confirmar (a) e (b). Este INC entrega
> o código que torna a medição possível; a medição em si é dele.

## Registro de conclusão

**Data:** 2026-08-06
**Branch:** `inc-026-push-service-worker` — empilhada sobre `inc-025-servico-app-compose`, **não**
sobre a `main`. Motivo: o teste ponta a ponta roda contra o serviço `app` do Compose, que só existe
no INC-025 e ainda não foi mergeado. O merge do 026 depende do merge do 025.
**Merge em main:** _(pendente — aguarda o teste no device e o sinal verde do Pedro)_

> **Este INC fecha a lacuna de medição real que mantinha o INC-012 em 🟡.** A medição nunca pôde ser
> feita porque não havia o que medir: o push chegava ao device e não existia handler para exibi-lo.
> **O status do INC-012 NÃO foi alterado aqui** — só muda depois de o Pedro confirmar (a) e (b) no
> iPhone real, com a tabela de `docs/02-Arquitetura/pwa-push-ios.md` preenchida.

### O que foi entregue

| Peça | Arquivo | Commit |
|---|---|---|
| `push` + `notificationclick` | `public/sw.js` | `dae8183` |
| URL de destino no payload + fim do catch mudo | `push-channel.ts`, `pendencias/[announcementId]/actions.ts` | `a548329` |
| Instrumentação dos catches do opt-in (metade cliente) | `push-opt-in.tsx`, contrato e reporter do INC-022 | `bc50320` |

### Formato do payload — antes e depois

Antes (INC-012), `PushNotificationChannel.send`:

```json
{ "title": "Conecta", "body": "RH pediu para você confirmar…", "announcementId": "dcbb9e41-…" }
```

`title` é constante `"Conecta"` (nunca varia); `body` é o `input.message` montado por
`remindPendingUsers`; `announcementId` vinha junto mas **nada o consumia**. **Não havia campo de URL
nem o slug do tenant.**

Depois:

```json
{ "title": "Conecta", "body": "…", "announcementId": "…", "url": "/{slug}/comunicados/{id}" }
```

`announcementId` foi mantido por compatibilidade. `url` só sai quando há slug **e**
`announcementId`; sem ela o SW abre a raiz.

### Decisões

1. **Destino do clique: `/{slug}/comunicados/{announcementId}`** (Pedro, 2026-08-06). É a tela do
   botão "Confirmar ciência" — exatamente o que a notificação pede. **`/{slug}/pendencias` foi
   descartada por ser `requireAdminOrManager`:** a cobrança é dirigida a quem está pendente, na
   maioria colaboradores, que cairiam em **403**.
2. **O slug entra pelo construtor do canal, não por `NotificationInput`.** Assim `remindPendingUsers`,
   o contrato `NotificationChannel` e o canal in-app ficam intocados — o comentário do INC-012 ("o
   único ponto de integração é este") continua verdadeiro. Consequência: o canal deixou de ser const
   de módulo, porque `session.tenantSlug` só existe por request. Os canais não guardam estado.
3. **O catch continua não relançando** (DP-17). A única mudança é logar. Reabrir o envio-dentro-da-
   transação não é escopo deste INC.
4. **Nada de `tag`/`renotify` no `showNotification`.** Agrupar por comunicado colapsaria uma segunda
   cobrança sobre a primeira — some justamente a insistência que a cobrança quer ter.

### Privacidade no log novo

`[PUSH_SEND_FAILED]` registra `statusCode`, **host** do endpoint, `userId` e a mensagem + `body` da
resposta do provedor, truncados em 200 chars. **Não** registra o endpoint completo: ele carrega o
token do dispositivo, que é material de autenticação. `userId` é uuid opaco, sem dado pessoal, e é o
que permite correlacionar com a subscription.

### Verificações

- `lint` limpo, `typecheck` limpo, **61 arquivos / 327 testes** verdes, `build` concluído.
  - **Flake observado, não regressão:** na primeira rodada `anonymization.test.ts` estourou o timeout
    de 5s. Passou isolado e passou na repetição da suíte completa. É o mesmo mecanismo de contenção
    já registrado (havia container `app` + `scheduler` batendo no mesmo banco). Nada neste INC toca
    esse caminho de código.
- Imagem rebuildada e container `healthy`; o `sw.js` servido pelo túnel já contém `push`,
  `notificationclick` e `showNotification`, com `Cache-Control: public, max-age=0` (o navegador
  revalida na checagem de atualização). `/icon-192.png` e `/icon-512.png` respondendo 200.
- **Nenhum push de teste foi disparado contra o iPhone do Pedro** — instrução explícita dele.

### Pendências

- **Teste no device (Pedro).** O service worker novo pode exigir **fechar e reabrir o PWA**, não só
  recarregar: `skipWaiting()` + `clients.claim()` já estão no arquivo, mas o iOS só busca a versão
  nova do SW na próxima inicialização do app instalado.
- **A inscrição pode ter sido penalizada.** O teste de hoje entregou pushes que não geraram
  notificação — violação de `userVisibleOnly`. Se a inscrição sumiu de **Perfil**, é preciso reativar
  antes do reteste.
- **`docs/02-Arquitetura/pwa-push-ios.md` continua vazia** — é a tabela que fecha o INC-012.
- **Merge:** depende do merge do INC-025 (branch empilhada).
