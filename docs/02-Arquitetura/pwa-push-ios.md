# Push no iOS — medição real (INC-012 / ADR-002)

> Este arquivo existe para cumprir o critério de aceite do INC-012 ("push testado em
> iPhone real, taxa de entrega registrada no vault") e a salvaguarda 1 da Nota de
> risco — iOS do `ADR-002`. Enquanto a tabela abaixo estiver vazia, o INC-012 **não
> está concluído**, mesmo com o código completo. Não presumir a taxa de entrega —
> medir.

## O que medir

Para cada aparelho de teste: instalar o PWA na home (Safari → Compartilhar → Adicionar
à Tela de Início, exigido no iOS para Web Push funcionar — iOS 16.4+), conceder a
permissão de notificação, disparar um evento real (comunicado crítico, cobrança de
pendência ou reação em post) e registrar se a notificação chegou, com que atraso, e em
que condição (app em background, fechado, tela bloqueada).

## Tabela de medição

_(preencher com testes reais — nenhuma linha ainda)_

| Data | Aparelho (modelo) | iOS | PWA instalado? | Evento disparado | Notificação chegou? | Atraso | Condição (bg/fechado/bloqueado) | Observações |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

## Leitura do resultado

- **Taxa de entrega boa** (definir limiar com o Pedro antes de julgar, ex. ≥80% em condição normal) → INC-012 pode ser marcado ✅ Concluído no roadmap.
- **Taxa de entrega ruim** → registrar aqui como gatilho do plano B (WhatsApp, ADR-002 "Gatilho de revisão"); não implementar o plano B neste INC, só registrar a decisão de acionar.

## Referências

- `docs/02-Arquitetura/ADR/ADR-002-pwa-mobile-first.md` — decisão e salvaguardas.
- `docs/04-Roadmap/incrementos/INC-012-pwa-push.md` — critérios de aceite.
