# Fluxo de Trabalho — Claude (chat) ↔ Claude Code ↔ Pedro

## Papéis

| Ator | Responsabilidade |
|---|---|
| **Pedro** | Dono do produto. Decide, valida, executa comandos git, mantém o vault no Obsidian. |
| **Claude (chat)** | Arquiteto e revisor. Escreve/atualiza documentação, gera prompts para o Claude Code, revisa entregas, aponta problemas. |
| **Claude Code** | Executor. Lê o vault, implementa o INC da vez, reporta o que fez. Não decide arquitetura. |

## O ciclo de um incremento (INC)

```
1. PLANEJAR   Claude (chat) garante que o INC-XXX está completo:
              objetivo, escopo, critérios de aceite, arquivos afetados.

2. PROMPT     Claude (chat) gera o prompt do INC para o Claude Code
              (modelo em prompt-kickoff-claude-code.md).

3. EXECUTAR   Pedro roda o Claude Code com o prompt.
              Claude Code lê o vault → implementa → escreve um
              RELATÓRIO DE ENTREGA (o que fez, decisões tomadas,
              como testar, pendências).

4. REVISAR    Pedro cola o relatório (e trechos de código relevantes)
              no chat. Claude (chat) verifica contra os critérios de
              aceite e os ADRs.
              ├─ Reprovado → Claude gera prompt de correção → volta ao 3.
              └─ Aprovado → segue ao 5.

5. FECHAR     Pedro: commit na branch do INC → push → merge.
              Pedro: marca o INC como ✅ no Obsidian e preenche
              a seção "Registro de conclusão" do INC.

6. PRÓXIMO    Claude (chat) confirma qual é o próximo INC e o ciclo
              reinicia.
```

## Regras do ciclo

1. **Um INC por vez.** Nunca dois INCs abertos em paralelo (evita conflito de branch e de contexto).
2. **O Claude Code não altera o escopo.** Se durante a implementação ele identificar que algo do INC está errado ou faltando, deve **parar e reportar**, não improvisar. A correção acontece na documentação primeiro.
3. **Decisão nova = ADR novo.** Se a implementação exigir uma decisão de arquitetura não coberta, ela volta para o chat, vira ADR, e só então o INC continua.
4. **Relatório de entrega é obrigatório.** Sem relatório, não há revisão; sem revisão, não há merge.
5. **O vault vive no repositório.** A pasta `docs/` do repo Git é o próprio vault do Obsidian (ou um submódulo/pasta sincronizada). Documentação e código andam no mesmo versionamento.

## Formato do Relatório de Entrega (Claude Code preenche)

```markdown
## Relatório de Entrega — INC-XXX
**Data:**
**Branch:** inc-XXX-nome-curto

### O que foi implementado
- ...

### Decisões tomadas durante a implementação
- ... (e por quê; sinalizar se alguma merece virar ADR)

### Como testar
- Passo a passo reproduzível

### Critérios de aceite
- [x/✗] Critério 1 — evidência
- [x/✗] Critério 2 — evidência

### Pendências / dívidas técnicas criadas
- ...
```
