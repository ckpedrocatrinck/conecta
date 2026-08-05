# INC-024 — Correções de navegação e fluxo (Módulo B)

**Status:** ⬜ Não iniciado
**Fase:** correção (pré-piloto)
**Origem:** teste manual real de 2026-08-04/05 (Pedro)
**Depende de:** INC-008, INC-010, INC-011

## Objetivo
Corrigir quatro problemas de navegação/fluxo identificados em teste manual real, no Feed e módulos adjacentes.

## Escopo

### Parte 1 — Link de aniversariantes sempre acessível
Hoje o link "Ver todos" na Home só aparece dentro do bloco condicional de aniversariantes de hoje (janela de 0 dias). Trocar para um link fixo, independente de haver aniversariante hoje, apontando para `/{slug}/aniversariantes` (rota já existe e funciona — confirmado por investigação em 2026-08-04). Texto sugerido: "Ver aniversariantes do mês". Não alterar o bottom nav (ADR-009, 5 slots já ocupados).

> **Desvio do texto sugerido (2026-08-05).** A rota de destino lista "hoje e os próximos 7 dias" (`WINDOW_DAYS = 7` em `aniversariantes/page.tsx`), não o mês. O rótulo entregue é **"Ver próximos aniversários"**, para o link não prometer uma janela que a tela não mostra. Trocar a janela da rota de 7 dias para o mês corrente é decisão de produto, fora do escopo desta parte — **pendência para o Pedro decidir**; se ele quiser o mês, o rótulo sugerido volta junto com a mudança de janela.

### Parte 2 — error.tsx em /[slug] (DP-30 / GAP-09)
Falta error boundary na árvore do tenant; hoje um erro de runtime nessa árvore cai na tela genérica em inglês do Next. Replicar o padrão de `src/app/error.tsx` (raiz) para `src/app/[slug]/error.tsx` — client component, props `error`/`reset`, mensagem em pt-BR, botão de tentar novamente (`reset()`), mesmo estilo visual (`EmptyState` ou equivalente) do resto do produto.

### Parte 3 — Vaga publicada não gera card no feed (investigar antes)
INC-011, item 5, especifica: "Vaga publicada gera card (template INC-009) no feed." Não está acontecendo. Investigar onde esse disparo deveria ocorrer (comparar com o padrão já existente de comunicado/aniversário, que geram card corretamente) e por que não dispara — nunca foi implementado, foi implementado em outro lugar e desconectado, ou removido em refactor. Se a investigação revelar decisão de arquitetura não óbvia, PARAR e reportar antes de implementar.

### Parte 4 — Upload de foto no post publica direto, sem confirmação (investigar antes)
Ao anexar foto durante a criação de um post, ela sobe/fica pública imediatamente, sem esperar a publicação do post. Investigar o fluxo atual: o attach persiste algo do post prematuramente? Existe estado de rascunho sendo pulado? Qual o comportamento hoje vs. o esperado. Se envolver decisão de UX não óbvia (ex.: introduzir estado de rascunho onde não existia), PARAR e reportar antes de implementar.

## Critérios de aceite
- [ ] Link de aniversariantes aparece na Home todos os dias, independente de haver aniversariante hoje.
- [ ] Erro de runtime real dentro de `/{slug}/*` mostra tela em pt-BR com botão de tentar novamente, não a tela genérica em inglês.
- [ ] Vaga publicada gera card visível no feed (critério exato a refinar após investigação da Parte 3).
- [ ] Anexar foto durante criação de post não a torna pública/permanente antes do post ser efetivamente publicado (critério exato a refinar após investigação da Parte 4).
- [ ] `npm run lint && npm run typecheck && npm run test && npm run build` verdes.

## Registro de conclusão
_(preencher)_
