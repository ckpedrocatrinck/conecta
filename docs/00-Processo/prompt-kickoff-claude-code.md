# Prompts para o Claude Code

## Prompt de Kickoff (usar UMA vez, no primeiro contato do Claude Code com o projeto)

```
Você vai trabalhar como executor de um projeto já especificado. Sua função é
implementar incrementos (INCs) exatamente como documentados — você NÃO decide
arquitetura nem altera escopo.

CONTEXTO
A documentação completa do projeto está em ./docs/ (vault Obsidian versionado
no repositório). Antes de escrever qualquer código, leia nesta ordem:

1. docs/README.md
2. docs/01-Produto/visao-e-tese.md
3. docs/01-Produto/escopo-mvp.md
4. docs/02-Arquitetura/stack.md
5. docs/02-Arquitetura/modelo-de-dados.md
6. docs/02-Arquitetura/ADR/ — todos os ADRs com status "Aceito"
7. docs/03-LGPD/lgpd-requisitos-tecnicos.md
8. docs/00-Processo/fluxo-de-trabalho.md e convencoes-git.md

Depois de ler, me responda com:
a) Um resumo de 10 linhas do produto e da arquitetura, nas suas palavras
   (para eu confirmar que você entendeu).
b) Qualquer contradição, ambiguidade ou lacuna que você encontrou na
   documentação. NÃO comece a implementar antes de eu confirmar.

REGRAS PERMANENTES
- Um INC por vez, na branch inc-XXX-nome-curto.
- Se algo não estiver documentado, PARE e pergunte. Não improvise decisões
  de arquitetura.
- Ao concluir um INC, gere o Relatório de Entrega no formato definido em
  docs/00-Processo/fluxo-de-trabalho.md. Não considere o INC terminado
  sem o relatório.
- Respeite os requisitos LGPD em TODOS os INCs que tocam dados pessoais.
- Código e comentários em inglês; textos de interface em pt-BR.
```

## Template de prompt por INC (usar a cada incremento)

```
Vamos executar o INC-XXX.

1. Releia docs/04-Roadmap/incrementos/INC-XXX-*.md (fonte de verdade do
   escopo) e os ADRs referenciados nele.
2. Crie a branch inc-XXX-nome-curto a partir da main atualizada.
3. Implemente APENAS o que está no escopo do INC. Critérios de aceite
   são o contrato.
4. Se encontrar impedimento, ambiguidade ou necessidade de decisão não
   documentada: pare e me reporte antes de continuar.
5. Ao final, gere o Relatório de Entrega completo, incluindo o passo a
   passo de como EU testo localmente.

Contexto adicional deste INC (se houver): [preencher ou remover]
```

## Prompt de correção (quando a revisão reprova)

```
A revisão do INC-XXX apontou os problemas abaixo. Corrija na MESMA branch,
sem alterar nada fora do escopo dos apontamentos, e gere um novo Relatório
de Entrega (versão 2) indicando o que mudou.

Apontamentos:
1. [colar apontamentos da revisão]
```
