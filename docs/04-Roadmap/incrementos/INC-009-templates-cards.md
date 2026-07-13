# INC-009 — Templates visuais de cards

**Status:** ⬜ Não iniciado
**Fase:** 3
**Depende de:** INC-008
**ADRs relevantes:** 004

## Objetivo
Matar o Canva: todo post gera card visual bonito automaticamente a partir dos dados.

## Escopo
1. Template HTML/CSS por tipo: reconhecimento, tempo de casa (X anos), promoção (cargo novo), aniversariante, vaga. Identidade visual configurável por tenant (logo + 1 cor de destaque — corrigido para bater com `design-system.md` §1; o texto original dizia "2 cores", divergência encontrada e resolvida com Pedro na execução deste INC).
2. Renderização server-side para imagem compartilhável (satori/og — decisão técnica documentada no relatório) + versão nativa no feed.
3. Preview do card no formulário do admin antes de publicar.
4. Botão "baixar card" (RH usa no WhatsApp/mural físico — atalho de adoção).

## Critérios de aceite
- [ ] Card legível com nomes longos (teste com nome de 40+ caracteres) e sem foto (fallback de avatar).
- [ ] Tenant com logo/cores diferentes gera card com a identidade dele.
- [ ] Geração < 2s por card.

## Registro de conclusão
_(preencher)_
