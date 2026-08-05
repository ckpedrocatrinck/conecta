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
              Marcar o INC como ✅ no roadmap (`04-Roadmap/roadmap.md`) e
              preencher a seção "Registro de conclusão" do INC (data,
              branch, DATA do merge) fazem parte do MESMO commit de
              fechamento — nunca um passo separado "para depois". É a
              causa raiz de INCs mergeados ficando com doc desatualizada
              (aconteceu com 007, 008, 009, 010, 011 — reconciliado em
              2026-07-16, achado A6-1 da auditoria).

6. PRÓXIMO    Claude (chat) confirma qual é o próximo INC e o ciclo
              reinicia.
```

## Regras do ciclo

1. **Um INC por vez.** Nunca dois INCs abertos em paralelo (evita conflito de branch e de contexto).
2. **O Claude Code não altera o escopo.** Se durante a implementação ele identificar que algo do INC está errado ou faltando, deve **parar e reportar**, não improvisar. A correção acontece na documentação primeiro.
3. **Decisão nova = ADR novo.** Se a implementação exigir uma decisão de arquitetura não coberta, ela volta para o chat, vira ADR, e só então o INC continua.
4. **Relatório de entrega é obrigatório.** Sem relatório, não há revisão; sem revisão, não há merge.
5. **O vault vive no repositório.** A pasta `docs/` do repo Git é o próprio vault do Obsidian (ou um submódulo/pasta sincronizada). Documentação e código andam no mesmo versionamento.
6. **O merge na `main` é documentado por DATA, não pelo hash do commit de merge** (convenção adotada em 2026-08-05). O hash do merge só existe *depois* que o merge acontece, então registrá-lo dentro do próprio commit de fechamento é impossível: obriga a uma branch extra só para escrever uma linha (aconteceu no INC-024, `1b2a38a`). Data resolve o que o registro precisa — situar o merge no tempo — e o hash está sempre no `git log` de qualquer jeito. Citar o hash **junto** da data é bem-vindo quando ele já existe por outro motivo (relato no chat, INC já mergeado, reconciliação de registro antigo); o que não se faz é **travar o fechamento esperando por ele**. Registros anteriores a esta data não precisam ser reabertos.
7. **Migration que cria tabela, ou feature que escreve num verbo novo, atualiza a matriz de GRANTs na MESMA branch.** A role de runtime `conecta_app` tem privilégio mínimo proposital e **não** há `ALTER DEFAULT PRIVILEGES` — tabela nova nasce sem nenhum GRANT. Concedeu-se o verbo exato na migration manual (ADR-008)? Então atualize o `EXPECTED` de `tests/integration/grants-matrix.test.ts` junto. O detector de drift falha o CI se houver GRANT faltando, GRANT sobrando ou tabela fora da matriz — foi instalado depois de o mesmo bug escapar duas vezes para produção (`GRANT UPDATE ON tenants` no INC-017; `GRANT DELETE ON branches` em 2026-07-27). Contexto completo em `docs/02-Arquitetura/infra-banco-dev-e-ci.md`.

## Formato do Relatório de Entrega (Claude Code preenche)

```markdown
## Relatório de Entrega — INC-XXX
**Data:**
**Branch:** inc-XXX-nome-curto
**Merge em main:** AAAA-MM-DD (data, não hash — ver regra 6)

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
