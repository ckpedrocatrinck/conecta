# Conecta

Plataforma de comunicação interna para PMEs (piloto: Rede Vale Verde). Ver `CLAUDE.md` e `docs/` para produto, arquitetura e processo de trabalho.

## Rodando local

```bash
git clone <url-do-repo> && cd conecta
npm install
cp .env.example .env
npm run dev
```

Abra http://localhost:3000. Healthcheck em http://localhost:3000/api/health.

## Qualidade

```bash
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run test       # Vitest
npm run format     # Prettier (grava)
```

CI (GitHub Actions) roda lint + typecheck + test em todo push de branch (exceto `main`).
