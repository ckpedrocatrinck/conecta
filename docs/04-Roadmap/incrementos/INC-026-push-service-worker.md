# INC-026 — Handler de push no service worker

**Status:** 🔄 em andamento
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
- [ ] Parse do payload que falhar **ainda assim** exibe notificação genérica (contrato
      `userVisibleOnly`), nunca pula o `showNotification`.
- [ ] `npm run lint && npm run typecheck && npm run test && npm run build` verdes.

> **O INC-012 só sai de 🟡 depois** do teste do Pedro no device confirmar (a) e (b). Este INC entrega
> o código que torna a medição possível; a medição em si é dele.

## Registro de conclusão

_(a preencher no fechamento)_
