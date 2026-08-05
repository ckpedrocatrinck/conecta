# Infra de banco: dev (Docker Compose) vs. CI (service container)

> Nota curta do INC-002. Complementa `stack.md` e `ADR-003`.

## Dois ambientes, dois mecanismos — de propósito

- **Dev local:** `docker-compose.yml` na raiz sobe um `postgres:16` persistente (volume nomeado `conecta_pgdata`), credenciais vindas do `.env` (nunca hardcoded no compose). Pensado para ficar de pé entre sessões (`docker compose up -d` / `down`).
- **CI (GitHub Actions):** um **service container** nativo do Actions (`services.postgres` em `.github/workflows/ci.yml`), efêmero, criado e destruído a cada run, com healthcheck `pg_isready`. **Não** é o `docker-compose.yml` de dev — a CI não depende de Compose, só do que o próprio Actions já sabe orquestrar (mais simples, mais rápido de provisionar por run, sem risco de vazar estado entre runs).
- O job de CI roda `prisma migrate deploy` (aplica as migrations existentes, sem diffing/prompt interativo — diferente de `migrate dev`, que é só para desenvolvimento) e `prisma db seed` antes de lint/typecheck/test.

## Duas roles Postgres, nos dois ambientes

Vale igualmente em dev e CI (ver `prisma/migrations/*_rls_and_triggers/migration.sql`):

- **Role owner/superuser** (`POSTGRES_USER` do compose / `conecta` na CI) — usada só por `prisma migrate` e pelo seed. É superuser porque a imagem oficial do Postgres sempre torna `POSTGRES_USER` superuser; superuser **sempre** ignora Row-Level Security, mesmo com `FORCE ROW LEVEL SECURITY`.
- **Role de runtime `conecta_app`** (não-superuser, criada por migration, sem senha versionada) — é quem a aplicação e os testes de isolamento usam de fato (`APP_DATABASE_URL`). Só com uma role não-superuser a RLS por `tenant_id` (ADR-003) é real, não decorativa.
- A senha de `conecta_app` nunca fica em SQL versionado: `ALTER ROLE conecta_app PASSWORD ...` roda a partir de `APP_DB_PASSWORD` (env) toda vez que o seed executa (`prisma/db-admin.ts`).

## Matriz de GRANTs do `conecta_app` e o detector de drift (2026-07-27)

O privilégio mínimo da role de runtime é **proposital**: `conecta_app` só recebe o verbo que cada feature realmente escreve, tabela por tabela, sempre por migration manual (ADR-008 — `GRANT` puro não gera diff de schema). **Não existe `ALTER DEFAULT PRIVILEGES`** neste banco, e isso é deliberado: default privileges dariam verbos automaticamente a toda tabela futura, exatamente o oposto do que se quer.

O custo dessa escolha é que **toda tabela nova nasce sem nenhum GRANT** — e até 2026-07-27 nada acusava a divergência. Dois bugs idênticos escaparam por esse buraco:

1. **INC-017** — faltava `GRANT UPDATE ON tenants` (tela "Aparência da empresa"): a primeira escrita da app nessa tabela.
2. **2026-07-27** — faltava `GRANT DELETE ON branches` ("Remover filial"): a ação só chama o `DELETE` depois de confirmar que a filial está vazia, então a FK `Restrict` não barrava; quem barrava era a permissão ausente (`42501`).

O furo nunca foi a lista de GRANTs — na auditoria completa ela estava 19/20 exata, com **zero verbo sobrando**. O furo era a ausência de quem percebesse a divergência.

**O detector:** `tests/integration/grants-matrix.test.ts` mantém o `EXPECTED` (tabela → verbos mínimos) como fonte de verdade versionada e compara contra `has_table_privilege('conecta_app', …)` de todas as tabelas de `public`. Falha em três direções, mais uma trava fixa:

| direção | o que pega |
|---|---|
| GRANT faltando | a app escreve e a role não pode → quebraria em produção com `42501` |
| GRANT sobrando | verbo concedido sem chamador no código → erosão do privilégio mínimo |
| tabela fora do `EXPECTED` | migration criou tabela e ninguém decidiu os GRANTs dela |
| `TRUNCATE` em qualquer tabela | `TRUNCATE` ignora RLS; a app nunca precisa dele |

As três direções foram verificadas **falhando** de propósito (grant injetado, grant revogado, tabela criada) antes de valer como rede — detector nunca visto falhar não é detector.

> **Regra de processo:** toda migration que cria tabela — ou toda feature que passa a escrever num verbo novo — atualiza o `EXPECTED` na **mesma branch**. Esquecer quebra o CI, não a produção. Ver também o checklist de fim de INC em `docs/00-Processo/fluxo-de-trabalho.md`.

`announcement_acks`, `announcement_versions` e `audit_logs` ficam sem `UPDATE`/`DELETE` por decisão de imutabilidade (regra 6 do `CLAUDE.md`, reforçada por trigger no banco). A matriz agora **documenta** isso, e o detector acusa se alguém conceder.

## `package-lock.json` é gerado em container Linux, não no Windows (DP-21, 2026-08-05)

**Regra:** qualquer alteração de dependência — adicionar, remover ou bumpar pacote em `package.json` — gera o lock assim, e é esse lock que vai para o commit:

```bash
docker run --rm -v <dir-do-repo>:/app -w /app node:22 npm install --package-lock-only
```

Nunca `npm install` direto na máquina de desenvolvimento (Windows). No Git Bash, prefixe `MSYS_NO_PATHCONV=1`, senão o MSYS converte o `-w /app` num caminho Windows e o `docker run` falha antes de subir o container.

**Por quê.** O `package.json` tem um bloco `overrides` fixando `@emnapi/core`, `@emnapi/runtime` e `@emnapi/wasi-threads` (entraram por CVE transitiva do Tailwind). No Linux, o npm instala o fallback wasm `@tailwindcss/oxide-wasm32-wasi`, que depende dos dois primeiros — então o lock **precisa** das entradas top-level `@emnapi/core@1.11.2` e `@emnapi/runtime@1.11.2`. No Windows esse fallback não é selecionado, e o npm **poda** as duas entradas do lock ao regravá-lo. O resultado é um lock que o `npm ci` do CI recusa:

```
Missing: @emnapi/runtime@1.11.2 from lock file
```

O `npm ci` é `--frozen-lockfile` por definição: ele não resolve nada, só instala o que o lock manda — então falha **antes de lint, typecheck ou teste**, e o sinal do CI fica vermelho por um motivo que não tem relação com a mudança. Foi assim que a branch `hardening/deps-cve` nasceu vermelha (`9d56cbc`), e é por isso que o INC-022 não pôde adicionar `jsdom` e o bump de `next` (DP-28/GAP-01a, 4 CVEs altos) ficou parado.

O que **não** funciona, já testado: os flags `--os=linux --cpu=x64 --libc=glibc` não impedem a poda, e `npm install --package-lock-only` no Windows poda igual. O que decide é a plataforma que resolve a árvore, não o flag.

**Alternativa não escolhida.** A outra saída seria remover os `overrides` de `@emnapi/*` — sem eles o npm não teria motivo para exigir versão exata e o lock do Windows seria aceito. Não foi escolhida: os overrides entraram para fechar uma CVE transitiva, e tirá-los reabriria essa CVE sem uma reavaliação própria de segurança. Fica registrada como alternativa conhecida e não explorada — não como pendência aberta.

**Como verificar o procedimento** (sem mexer em dependência nenhuma): rode o comando acima no estado atual e confira que `git diff package-lock.json` sai **vazio** — o lock commitado já é um lock de Linux, então regenerá-lo é idempotente. Depois `rm -rf node_modules && npm ci`, que é o comando exato do CI. Verificado nessa forma em 2026-08-05: diff vazio (md5 idêntico), `npm ci` instalou 743 pacotes sem erro, entradas `@emnapi/core@1.11.2` e `@emnapi/runtime@1.11.2` presentes no lock. Diff **grande** nesse teste é sinal de que o lock commitado saiu de uma plataforma errada: pare e investigue antes de commitar.

> **Depois de um `npm ci` limpo na máquina Windows, rode `npx prisma generate` antes de qualquer `typecheck`.** O `postinstall` do `@prisma/client` deixa um **stub** (`node_modules/.prisma/client/index.d.ts` com ~110 linhas e `PrismaClient: any`) em vez do client tipado, e o `tsc --noEmit` então acusa centenas de erros que **não** são regressão de código — foram 416 no teste de 2026-08-05, todos da forma `has no exported member 'UserRole'` / `is of type 'unknown'`, todos zerados por um `prisma generate`. Isso é ruído do ambiente local, não do CI: no runner Linux o `postinstall` gera o client de verdade (é por isso que o `ci.yml` funciona sem um passo `prisma generate` explícito, entre `npm ci` e `prisma migrate deploy`). Só não confunda o sintoma com um lock ruim ao verificar este procedimento.

## Variáveis de ambiente novas (INC-002)

`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (compose), `DATABASE_URL` (role owner), `APP_DB_PASSWORD` + `APP_DATABASE_URL` (role `conecta_app`), `CPF_HASH_PEPPER` (ADR-006). Documentadas com comentário em `.env.example`; valores reais nunca commitados.

## Auth.js `trustHost` em produção (achado de QA pós-INC-012.5, 2026-07-16)

O Auth.js (`next-auth` 5.0.0-beta.31) só confia automaticamente no host da requisição em dois casos: **dev** (`NODE_ENV !== "production"`) ou quando detecta uma plataforma conhecida via env var (`VERCEL`, `CF_PAGES`). Fora disso — ou seja, em produção rodando fora dessas plataformas (`next start` on-premise/local) — `trustHost` resolve para `false`, e **todo** login (com credencial válida ou não) falha com um JSON genérico em inglês ("There was a problem with the server configuration...") antes mesmo de chamar o `authorize()` do Credentials provider. Não é um bug do código de auth do Conecta (`src/lib/auth/config.ts`) — é o Auth.js recusando operar sem saber se pode confiar no `Host` da requisição.

- **Na Vercel** (hospedagem-alvo do piloto, ver `stack.md`): resolve sozinho, `VERCEL=1` já vem definido pela plataforma. Nenhuma ação necessária.
- **On-premise/local em modo produção** (`next build && next start`, ex. para testar antes de subir): definir `AUTH_TRUST_HOST=true` (ou `AUTH_URL` com a URL pública real) no ambiente antes de iniciar.
- **Rede de segurança:** `src/lib/auth/assert-trust-host.ts` (`assertAuthTrustHostConfigured`, chamada em `instrumentation.ts` junto do `assertRuntimeAppRole` do A4-3) falha o boot com uma mensagem clara caso nenhuma das quatro env vars conhecidas (`VERCEL`, `CF_PAGES`, `AUTH_TRUST_HOST`, `AUTH_URL`) esteja presente **em produção** — não roda em dev, para não travar o fluxo local. Não reimplementa a lógica interna do Auth.js (que pode mudar entre versões); só confere a presença dessas quatro variáveis.
