# Convenções de Git

## Branches

- `main` — sempre estável e deployável. Só recebe merge de INC aprovado.
- `inc-XXX-nome-curto` — uma branch por incremento. Ex.: `inc-004-crud-comunicados`.
- Sem branch de develop no MVP: o time é uma pessoa; `main` + branch de INC basta.

## Commits

Padrão **Conventional Commits** com referência ao INC:

```
<tipo>(INC-XXX): descrição curta no imperativo

Tipos: feat | fix | refactor | docs | test | chore
```

Exemplos:
- `feat(INC-004): criar CRUD de comunicados no painel admin`
- `docs(INC-000): adicionar ADR-006 sobre estratégia de push`
- `fix(INC-005): corrigir timestamp de confirmação em fuso America/Sao_Paulo`

## Fluxo por INC

```bash
git checkout main && git pull
git checkout -b inc-XXX-nome-curto
# ... Claude Code trabalha ...
git add -A && git commit -m "feat(INC-XXX): ..."
git push -u origin inc-XXX-nome-curto
# após aprovação na revisão:
git checkout main && git pull
git merge --no-ff inc-XXX-nome-curto
git push
```

## Regras

1. Nunca commitar direto na `main`.
2. Nunca commitar segredos (`.env` no `.gitignore` desde o INC-001; usar `.env.example`).
3. A pasta `docs/` (vault) é commitada junto — mudança de documentação relacionada ao INC entra na mesma branch com prefixo `docs:`.
4. Merge só após INC marcado como aprovado na revisão do chat.
5. Merge de INC (ou de qualquer branch) na `main` sempre com `--no-ff` — nunca fast-forward. Um commit de merge de verdade dispara o CI na `main` (o workflow roda em todo `push`, inclusive na `main`) e deixa no histórico exatamente onde cada INC entrou, em vez de diluir os commits da branch na linha reta da `main`.
