# ADR-004 — Templates visuais no MVP; IA como camada plugável de fase 2

**Status:** Aceito
**Aceito em:** 2026-07-09 (Pedro Catrinck)
**Data:** 2026-07-09
**Decisores:** Pedro Catrinck

## Contexto
A causa raiz do abandono da portal legado é o custo de alimentação: o RH monta cartazes no Canva e sobe como imagem porque o sistema não ajuda a produzir conteúdo estruturado bonito. IA generativa resolveria, mas cria custo variável e dependência externa no MVP. Análise de custo: o uso real (RH, ~100-200 gerações/mês, textos curtos) custaria unidades de reais/mês — irrelevante na margem, mas ainda assim uma dependência que o MVP não precisa ter.

## Decisão
1. **MVP:** cards visuais (aniversariante, reconhecimento, tempo de casa, promoção, vaga) são **gerados automaticamente por templates HTML/CSS** a partir dos dados estruturados. Custo zero por card, sem dependência externa. O produto funciona 100% sem IA.
2. **Fase 2:** assistência por IA entra como ações explícitas no painel (formatar rascunho, resumir, gerar quiz), atrás de uma interface interna `ContentAssistant` que isola o fornecedor do modelo. Vira diferencial de plano (upsell), não custo fixo.

## Alternativas consideradas
- **IA desde o MVP** — diferencial imediato, mas adiciona chave de API, tratamento de falha e custo variável antes de validar o produto; rejeitada como núcleo (nada impede protótipo isolado).
- **Sem geração nenhuma (só CRUD)** — vira "painel gerenciável" indistinguível de concorrentes e não ataca a causa raiz; rejeitada.

## Consequências
+ MVP sem custo variável nem dependência externa; demo funciona offline.
+ IA vira argumento comercial de upgrade em vez de risco de margem.
− Templates exigem design cuidadoso por tipo de post (esforço de frontend no INC correspondente).

## Gatilho de revisão
Piloto validado + primeiro cliente pagante → especificar fase 2 de IA (modelo pequeno para formatação; medir custo real por tenant).
