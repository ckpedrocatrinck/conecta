# INC-001 — Setup do repositório e esqueleto

**Status:** ✅ Concluído
**Fase:** 1 — Fundação técnica
**Depende de:** ADRs 001-005 aceitos
**ADRs relevantes:** 002, 005

## Objetivo
Repositório funcional com o esqueleto da aplicação, qualidade automatizada e a documentação (este vault) versionada junto.

## Escopo
1. Repo GitHub privado; estrutura Next.js App Router + TypeScript estrito + Tailwind + shadcn/ui.
2. Pasta `docs/` = este vault (copiado para dentro do repo).
3. `CLAUDE.md` na raiz (arquivo já pronto, entregue junto do vault) e `.claude/commands/` com kickoff, inc, correcao e status.
4. `.claude/settings.json` com allowlist de permissões (npm/prisma/git básico) e negação de leitura de `.env*` e de `git push --force`, conforme `docs/00-Processo/claude-code-boas-praticas.md`.
5. ESLint + Prettier + typecheck; GitHub Actions rodando lint/typecheck/test em push de branch.
6. `.env.example` documentado; `.env` no gitignore.
7. Página raiz placeholder e healthcheck (`/api/health`).
8. README do repo: como rodar local em ≤ 5 comandos.

## Fora do escopo
Banco, auth, qualquer feature de domínio.

## Critérios de aceite
- [x] `npm run dev` sobe local seguindo só o README.
- [x] CI verde na branch do INC.
- [x] `docs/` presente e navegável no repo.
- [x] Nenhum segredo commitado.
- [x] `/kickoff` e `/inc` funcionam como slash commands na sessão.
- [x] Tentativa de ler `.env` pelo Claude Code é bloqueada pela configuração.

## Registro de conclusão
- **Data:** 2026-07-09
- **Branch:** `inc-001-setup-repositorio`
- **Commit final da branch:** `2fceb60` (fix(INC-001): regenerar package-lock.json do zero) — merge para `main` ainda pendente, a cargo do Pedro.
- **Repositório remoto:** https://github.com/pedromcatrinck/conecta (privado)
- **CI:** verde — https://github.com/pedromcatrinck/conecta/actions/runs/29049213260
- **Observações:** `main` foi criada no remoto com um commit inicial vazio (sem o conteúdo do INC-001) e definida como branch padrão do repo; o merge de `inc-001-setup-repositorio` para `main` continua sendo ação do Pedro. Duas iterações de correção de `package-lock.json` foram necessárias até a CI passar no runner Linux do GitHub Actions (lockfile gerado originalmente no Windows). Ver Relatório de Entrega e adendo na sessão de execução para detalhes completos.
