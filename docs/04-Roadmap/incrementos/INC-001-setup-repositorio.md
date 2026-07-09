# INC-001 — Setup do repositório e esqueleto

**Status:** ⬜ Não iniciado
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
- [ ] `npm run dev` sobe local seguindo só o README.
- [ ] CI verde na branch do INC.
- [ ] `docs/` presente e navegável no repo.
- [ ] Nenhum segredo commitado.
- [ ] `/kickoff` e `/inc` funcionam como slash commands na sessão.
- [ ] Tentativa de ler `.env` pelo Claude Code é bloqueada pela configuração.

## Registro de conclusão
_(preencher ao fechar: data, branch, commit de merge, observações)_
