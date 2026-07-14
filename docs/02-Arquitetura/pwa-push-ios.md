# Push no iOS — limitações e medição real (INC-012)

> Ver ADR-002 (nota de risco) e ADR-002 (plano assumido) para o contexto de
> por que isso é material, não marginal: parcela relevante da base do piloto
> usa iPhone.

## O que a plataforma garante (documentado, não é presunção)

- Push Web (`pushManager.subscribe`) no Safari/iOS **só funciona com o PWA já
  instalado na Tela de Início** (`display-mode: standalone`). Numa aba comum
  do Safari, a chamada falha — o app detecta isso (`isIos() && !isStandalone()`
  em `src/lib/pwa/platform.ts`) e nunca deixa o colaborador tentar sem instalar
  primeiro.
- Requer **iOS 16.4+**. Versões anteriores não têm Web Push de forma alguma,
  instalado ou não.
- Instalação no iOS é sempre manual (Compartilhar → Adicionar à Tela de
  Início) — não existe `beforeinstallprompt` no Safari.

## O que precisa ser medido em teste real (não presumir)

_(preencher após o roteiro de iPhone físico do Relatório de Entrega do
INC-012 — Pedro)_

| Medição | Resultado |
|---|---|
| Push chega com o app fechado (background)? | — |
| Tempo entre "Cobrar pendentes" e a notificação aparecer | — |
| Push chega depois de reiniciar o iPhone sem reabrir o app? | — |
| iOS revoga a subscription silenciosamente em algum cenário observado? | — |
| Modelo/versão do iPhone testado | — |
| Versão do iOS testado | — |

## Gatilho do plano B (ADR-002)

Se a taxa de entrega medida for ruim **e** push for crítico para adoção →
antecipar o plano B (WhatsApp, fase 2) ou app nativo. Este documento é onde
esse dado fica registrado — decisão em si continua no ADR-002.
