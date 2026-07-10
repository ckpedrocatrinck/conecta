# Boas Práticas — Claude Code neste projeto

> Complementa `fluxo-de-trabalho.md`. Fontes: docs oficiais de memória do Claude Code + prática de comunidade (2026). Revisar quando o Claude Code mudar de versão maior.

## 1. CLAUDE.md (raiz do repo)

- É lido no início de **toda** sessão e compete pelo contexto. Regra de ouro: **alto sinal, curto** (~60-120 linhas; acima de ~200 o modelo passa a ignorar regras).
- Teste para cada linha: *"remover isto causaria um erro do Claude?"* Se não, corta.
- Conteúdo certo: comandos que ele não adivinha, regras invioláveis, convenções que divergem do padrão, ponteiros para `docs/`. Conteúdo errado: tutorial, personalidade ("aja como sênior"), duplicação do que está em `docs/`.
- **Ponteiros, não colagem:** o CLAUDE.md referencia `docs/...` por caminho; o Claude Code lê sob demanda. (Existe import com `@arquivo`, mas o conteúdo importado expande inline e consome contexto em toda sessão — usar só para arquivos minúsculos, se usar.)
- CLAUDE.md é guia, não trava: instrução em memória tem adesão alta mas não garantida. O que for **inegociável** (ex.: nunca tocar `.env`, nunca `git push --force`) deve virar hook/permissão (item 3), não só texto.
- Manutenção: quando você corrigir o Claude Code duas vezes pelo mesmo motivo, a correção vira linha no CLAUDE.md (ou regra em `.claude/rules/` se for específica de uma área).

## 2. Slash commands (`.claude/commands/`)

Os prompts do processo viraram comandos versionados no repo — mais confiável que colar texto:

| Comando | Uso |
|---|---|
| `/kickoff` | Primeiro contato com o projeto (leitura + relatório de lacunas) |
| `/inc 004` | Executa um incremento (o `$ARGUMENTS` vira o número) |
| `/correcao <apontamentos>` | Ciclo de correção pós-revisão |
| `/status` | Auditoria rápida: código vs. documentação |

## 3. Permissões e travas (fazer no INC-001)

- Rodar `/permissions` e configurar allowlist em `.claude/settings.json` (versionado): permitir `npm run *`, `npx prisma *`, `git` básico; **negar** leitura de `.env*`, `git push --force`, comandos de rede arbitrários.
- Preferência pessoal fora do repo: `.claude/settings.local.json` (gitignored).
- Se algo for absolutamente proibido, usar **hook PreToolUse** (bloqueio de verdade) em vez de instrução no CLAUDE.md.
- Nunca colar segredo na conversa; segredo vive em env.

## 4. Higiene de sessão e contexto

- **`/clear` entre INCs.** Cada INC começa com contexto limpo — o estado vive no vault e no git, não na conversa. É também o que mantém a revisão externa honesta.
- Preferir sessões curtas e focadas a maratonas com `/compact`.
- `/init` não é necessário aqui (o CLAUDE.md já foi escrito manualmente e melhor do que o gerado).
- Auto memory: o Claude Code mantém notas próprias por repositório. Inspecionar com `/memory` de vez em quando; se ele "aprendeu" algo que contradiz o vault, apagar a nota e corrigir a fonte.

## 5. Plan mode sempre antes de editar

Todo `/inc` exige plano aprovado antes da primeira edição (já embutido no comando). Custa 1 minuto e elimina a classe inteira de "implementou a coisa errada rápido".

## 6. O que continua valendo do fluxo

Nada aqui substitui o ciclo de `fluxo-de-trabalho.md`: revisão externa nos INCs 001-007 e 013, relatório de entrega obrigatório, decisão nova = ADR. CLAUDE.md e comandos só tornam a execução mais estável — o julgamento continua fora do executor.
