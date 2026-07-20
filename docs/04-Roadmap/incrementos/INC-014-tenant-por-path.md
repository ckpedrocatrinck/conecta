# INC-014 — Resolução de tenant por path (`/{slug}`)

**Status:** ✅ Concluído (2026-07-20)
**Fase:** fundação (antes do hardening INC-013)
**Depende de:** ADR-010 (aceito)
**Natureza:** mudança de FUNDAÇÃO — toca middleware, auth, roteamento de todas as rotas, navegação. Risco de regressão em auth/isolamento. Sem pressa, teste de isolamento reforçado, blocos revisáveis.

## Objetivo
Migrar a resolução de tenant do seletor de empresa no login para o path da URL
(`conecta.com.br/{slug}`), conforme ADR-010, SEM enfraquecer o isolamento entre
tenants que a auditoria confirmou sólido.

## Princípio-mestre
A barreira de isolamento (RLS + withTenant + set_config) NÃO muda. Só muda a
FONTE do tenantId: da lista no login para o path da URL. Se em algum momento a
mudança parecer exigir tocar as policies de RLS ou o withTenant → PARE e
pergunte (não deveria ser necessário).

## Escopo em blocos revisáveis

### BLOCO 1 — Resolução de tenant no middleware (sem migrar rotas ainda)
- Middleware extrai o 1º segmento do path como slug candidato.
- Resolve slug → tenantId (com cache; slugs estáveis). Slug inexistente →
  página 404 "empresa não encontrada", sem vazar lista de tenants.
- Propaga tenantId resolvido para o request (header interno/contexto).
- CHECKPOINT: testes de resolução (slug válido resolve, inválido → 404 sem vazar).

### BLOCO 2 — Login tenant-scoped (revoga seletor de empresa)
- Login vive em /{slug}/login. Remove o seletor de empresa do formulário.
- authorize recebe tenantId da URL/contexto, não do form. CPF+senha idênticos.
- Busca de usuário por cpf_hash escopada ao tenant da URL.
- Sessão passa a carregar/validar o tenantId (para o Bloco 3).
- CHECKPOINT: login funciona por URL; testes de auth verdes.

### BLOCO 3 — Vínculo sessão↔tenant + caso cross-tenant (o mais crítico)
- Sessão validada contra o tenant da URL em TODA request.
- Sessão do tenant A em URL do tenant B → redireciona a /{slug-B}/login,
  NÃO aceita a sessão do A no B (decisão ADR-010).
- Cookie de sessão: validação server-side do vínculo (tabela Session já existe).
- TESTES DE ISOLAMENTO REFORÇADO (obrigatório, o coração do INC):
  - sessão do tenant A rejeitada em URL do tenant B (cai no login do B);
  - slug inexistente → 404 sem vazar;
  - tenant da URL governa o set_config, não valor do cliente;
  - os testes de RLS existentes (tenant-isolation.test.ts) continuam verdes.
- CHECKPOINT: revisão minha + QA do fluxo cross-tenant antes de migrar rotas.

### BLOCO 4 — Migração das rotas para sob /{slug}
- Route group (app) passa para sob o segmento de slug: /{slug}/comunicados,
  /{slug}/admin/…, etc.
- Navegação (ADR-009) monta links já com o slug corrente. Sem mudança de
  papel/autorização — só o prefixo.
- Redirects (pós-login, onboarding), links absolutos, e PWA/service worker
  consideram o slug (start_url do manifest por tenant — avaliar).
- ATENÇÃO service worker: lembrar do INC-012 (SW deu muito trabalho). O start_url
  e o escopo do SW mudam com o slug — testar instalação/PWA por tenant.
- CHECKPOINT: QA de navegação completa (todas as rotas sob slug funcionam).

## Fora de escopo
- Site institucional em conecta.com.br (raiz) — projeto próprio, é a vitrine.
- Domínio customizado por tenant (portal.cliente.com.br) — fase enterprise.
- Personalização visual por tenant a partir da URL — futuro (o slug habilita,
  mas a personalização é outro trabalho).

## Critérios de aceite
- [x] conecta.com.br/{slug} resolve o tenant correto; slug inválido → "empresa não encontrada" sem vazar lista. — `resolve-tenant.ts` + boundary `[slug]/layout.tsx`; provado em `tenant-resolution.test.ts` e QA de Pedro.
- [x] Login por URL funciona; seletor de empresa removido. — `/{slug}/login` ([slug]/login), `<select>` de empresa removido; tenant vem de `params` via `.bind`.
- [x] Sessão do tenant A NUNCA acessa dados do tenant B (cai no login do B). — QA de Pedro confirmou cross-tenant limpo **nos dois sentidos** (A→B e B→A caem no login sem vazar); guard Node `requireSessionWithSlug` + RLS.
- [x] Testes de isolamento reforçado verdes + os de RLS existentes intactos. — `tenant-path-isolation.test.ts` (decisão pura + backstop RLS) + `tenant-isolation.test.ts` intocado.
- [x] Todas as rotas migradas para /{slug}; navegação e redirects corretos. — `(app)`, `trocar-senha`, `aviso-privacidade` sob `[slug]`; links/redirects/nav slug-aware; build lista tudo sob `/[slug]`.
- [x] PWA/service worker funciona por tenant (instalação testada). — manifest por tenant em `/{slug}/manifest` (`start_url`/`id`/`scope` = `/{slug}`); SW **não alterado** (network-first agnóstico de path, INC-012); instalação verificada por tenant.
- [x] Nenhuma regressão: lint+typecheck+test verdes; QA de login e isolamento. — 37 arquivos / 191 testes verdes; build de produção OK.

## Registro de conclusão

**Concluído em 2026-07-20** na branch `inc-014-tenant-por-path` (merge `--no-ff` na `main` no fechamento). `lint + typecheck + test` verdes (37 arquivos / 191 testes) + build de produção OK. Princípio-mestre respeitado: `withTenant` + RLS **intocados** — só mudou a FONTE do `tenantId` (do seletor no login para o path da URL).

### Relatório de Entrega — INC-014
**Data:** 2026-07-20
**Branch:** inc-014-tenant-por-path

#### O que foi implementado (por bloco)
- **Bloco 0 — Setup** (`d482633`, `5f94b75`, `72a887b`): merge `--no-ff` do INC-013.5 na `main`; branch `inc-014` da `main` atualizada; ADR-010 movido para `docs/02-Arquitetura/ADR/` **com §2 corrigido** (resolução autoritativa na camada Node, não no middleware Edge).
- **Bloco 1 — Resolução** (`6036222`): `slug-path.ts` (Edge, extração de slug string-pura) + `resolve-tenant.ts` (Node, `getTenantBySlug` cache) + componente "empresa não encontrada" + middleware propaga `x-tenant-slug` (sempre reescrito no servidor — anti-spoofing).
- **Bloco 2 — Login tenant-scoped** (`b2118a2`): `/{slug}/login` sob boundary `[slug]/layout.tsx` (resolve + `notFound`); seletor de empresa removido; `tenantSlug` no JWT (dep. do Bloco 3); `/{slug}/login` público.
- **Bloco 3 — Vínculo sessão↔tenant** (`cb61dca`): `sessionMatchesTenant` (type-guard puro) + `requireSessionWithSlug` (base dos guards); testes de isolamento reforçado (decisão pura + **backstop RLS**: a `Session` de A não existe no contexto de B).
- **Bloco 4 — Migração de rotas + nav + PWA** (`5cc0927`, `2f53abf`): `(app)`/onboarding sob `[slug]`; `/login` legado removido; imports que escapavam → alias `@/`; links/redirects/nav slug-aware; guards ligados nas rotas; Edge compare (fast-fail); manifest por tenant; SW inalterado.

#### Decisões tomadas durante a implementação
1. **Correção do ADR-010 §2** (aprovada por Pedro no kickoff): o ADR dizia "middleware resolve slug→tenantId", mas o middleware é Edge-sem-banco (ADR-007). Resolução autoritativa movida para a camada Node (boundary `[slug]` + `getActiveSession`); Edge faz só a checagem leve via `tenantSlug` do JWT. Objetivo do ADR inalterado.
2. **Edge compare adiado do Bloco 3 para o 4** (aprovado): ligá-lo no Bloco 3 quebraria as rotas planas ainda vivas. A barreira real (Node + RLS) foi provada no Bloco 3; o Edge (fast-fail de UX) entrou com a migração.
3. **`/403` permanece global** (página de erro sem dado de tenant); onboarding (`trocar-senha`, `aviso-privacidade`) é tenant-scoped.
4. **`/{slug}/manifest` público** (QA de runtime revelou): o browser busca o manifest no install/login sem sessão.

#### Como testar (QA cross-tenant — o gate do INC)
**Pré-requisitos:** `docker compose up -d postgres` · `npm run db:seed` · `npm run db:seed:tenant-b` · `npm run dev`.
Credenciais: tenant A `vale-verde` admin CPF `10000000000`; tenant B `tere-frutas` admin CPF `10000500000`; senha `Trocar123!` (troca no 1º acesso).
1. `/{slug}/login` sem seletor de empresa; `/empresa-inexistente` → "empresa não encontrada" (sem listar tenants); `/` → 404.
2. Logar em A → onboarding e navegação sempre sob `/vale-verde/…`.
3. **Cross-tenant:** logado em A, abrir `/tere-frutas/...` → cai em `/tere-frutas/login`, **nunca** dados de B. Logar em B e abrir `/vale-verde/...` → cai no login de A. (Confirmado por Pedro nos dois sentidos.)
4. PWA (build de prod, `AUTH_TRUST_HOST=true npm start`): instalar por tenant → cada app abre na sua home.
5. `npm run lint && npm run typecheck && npm run test` verdes.

#### Pendências / dívidas técnicas criadas
- **Site institucional em `/` (raiz)** hoje é 404 — é a vitrine comercial, projeto próprio (fora de escopo do ADR-010).
- **Status HTTP do 404 de slug inválido** pode vir 200 (streaming do `loading.tsx` global faz flush do shell antes do `notFound()`) — comportamento **pré-existente** de todo `notFound()` do app; conteúdo correto e sem vazamento.
- **`seed-dev-tenant-b.ts` / `db:seed:tenant-b`** é tooling de QA dev-only — pode ser removido depois do piloto.
- **Guard de boot Auth.js** exige `AUTH_TRUST_HOST=true`/`AUTH_URL` em produção fora de Vercel/CF (pré-existente, não do INC).
