# Push no iOS — limitações e medição real (INC-012 / ADR-002)

> Este arquivo existe para cumprir o critério de aceite do INC-012 ("push testado em
> iPhone real, taxa de entrega registrada no vault") e a salvaguarda 1 da Nota de
> risco — iOS do `ADR-002`: parcela relevante da base do piloto usa iPhone, então o
> risco é material, não marginal. Enquanto a tabela abaixo estiver vazia, o INC-012
> **não está concluído**, mesmo com o código completo. Não presumir a taxa de
> entrega — medir.

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

## O que medir em teste real (não presumir)

Para cada aparelho de teste: instalar o PWA na home, conceder a permissão de
notificação, disparar um evento real (comunicado crítico, cobrança de
pendência ou reação em post) e registrar:

_(preencher com testes reais — nenhuma linha ainda)_

| Data | Aparelho (modelo) | iOS | Push chega com app fechado (background)? | Tempo entre o evento e a notificação aparecer | Push chega depois de reiniciar o iPhone sem reabrir o app? | iOS revogou a subscription silenciosamente em algum cenário? | Observações |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## Leitura do resultado

- **Taxa de entrega boa** (definir limiar com o Pedro antes de julgar, ex. ≥80% em condição normal) → INC-012 pode ser marcado ✅ Concluído no roadmap.
- **Taxa de entrega ruim** e push crítico para adoção → gatilho do plano B (WhatsApp, fase 2) ou app nativo, conforme ADR-002 "Gatilho de revisão"; não implementar o plano B neste INC, só registrar a decisão de acionar.

## Referências

- `docs/02-Arquitetura/ADR/ADR-002-pwa-mobile-first.md` — decisão, nota de risco e salvaguardas.
- `docs/04-Roadmap/incrementos/INC-012-pwa-push.md` — critérios de aceite.
