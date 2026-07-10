# ADR-002 — PWA mobile-first, sem app nativo no MVP

**Status:** Aceito
**Aceito em:** 2026-07-09 (Pedro Catrinck)
**Data:** 2026-07-09
**Decisores:** Pedro Catrinck

## Contexto
Usuário final é operacional: só celular (maioria Android modesto), dados móveis limitados, sem e-mail corporativo. A portal legado já opera como web app com bottom bar e push — o formato está validado; a execução é que é ruim. Publicar app nativo custa contas de loja, ciclo de review e manutenção dupla — inviável para um fundador solo no MVP.

## Decisão
Uma única aplicação web responsiva **PWA instalável** (manifest + service worker): mobile-first para o colaborador, com painel admin utilizável em desktop. Push via Web Push/VAPID. Cache offline de leitura para as telas principais.

## Alternativas consideradas
- **App nativo (React Native/Flutter)** — melhor push no iOS, mas dobra o esforço e trava a velocidade de iteração do piloto; rejeitada no MVP.
- **Web comum sem PWA** — perde instalação na home e push, que são o mecanismo de retorno diário; rejeitada.

## Consequências
+ Um código, deploy contínuo, sem lojas.
+ Push gratuito e padrão aberto.
− Push no iOS exige PWA instalado (iOS 16.4+) e é menos confiável — **risco elevado**: ver nota abaixo.
− Recursos nativos profundos (biometria etc.) ficam indisponíveis — não são necessários no escopo.

## Nota de risco — iOS (atualizada 2026-07-09)
Levantamento com Pedro confirmou que a base do piloto é majoritariamente Android **mas com parcela relevante de iPhone**. Isso torna o risco de push no iOS material, não marginal. Decisão mantida (PWA no MVP), com duas salvaguardas:
1. O INC-012 deve **medir empiricamente** a taxa de entrega de push em iPhone real durante o piloto (não assumir que funciona).
2. Plano B pré-aprovado para notificação crítica: WhatsApp (fase 2). Não se constrói no MVP, mas fica como caminho conhecido caso a métrica de iOS seja ruim.

## Plano assumido (não é "talvez")
App nativo nas lojas (App Store / Play Store) **será feito no futuro** — é intenção declarada de Pedro, não uma possibilidade remota. O PWA é a estratégia do MVP/piloto pelo custo e velocidade; o nativo entra em fase posterior, provavelmente como wrapper sobre a mesma base ou reescrita da camada de app conforme os dados do piloto indicarem.

## Gatilho de revisão
Métrica do piloto mostrar parcela relevante de iOS com push falhando E push ser crítico para adoção → antecipar app nativo ou ativar o plano B de WhatsApp.
