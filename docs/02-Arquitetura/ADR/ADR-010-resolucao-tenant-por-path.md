# ADR-010 — Resolução de tenant por path na URL (`/empresa`)

**Status:** Aceito
**Aceito em:** 2026-07-20 (Pedro Catrinck)
**Data:** 2026-07-20
**Decisores:** Pedro Catrinck
**Relaciona-se com:** ADR-003 (multi-tenant + RLS), ADR-006 (auth por CPF), ADR-007 (sessão JWT + split Edge/Node), ADR-009 (navegação)
**Revoga parcialmente:** ADR-006 item 1 (a parte da seleção de empresa no login)

## Contexto
Hoje o tenant é resolvido por um **seletor de empresa no login**: a pessoa digita CPF + senha e escolhe a empresa numa lista. Isso tem três problemas à medida que o produto vai para múltiplos clientes:
1. O seletor **expõe a lista de empresas clientes** a qualquer visitante da tela de login — vazamento comercial.
2. Não há um **endereço próprio por cliente** para o RH divulgar aos funcionários ("acesse o site e selecione a empresa" é pior que "acesse conecta.com.br/valeverde").
3. Dificulta personalização por tenant (marca/identidade) já a partir da URL.

A direção comercial (site institucional em `conecta.com.br` para venda + uma URL por cliente contratado) exige que o tenant seja identificado **pela URL**, antes do login.

## Decisão

### 1. Tenant no path: `conecta.com.br/{slug-da-empresa}`
- Cada tenant tem um **slug** único (já existe: `Tenant.slug`, ex.: `vale-verde`). A URL do produto para aquele cliente é `conecta.com.br/{slug}` (ex.: `conecta.com.br/valeverde`).
- Escolha **path-based** (não subdomínio) — decisão de Pedro. Mais simples de operar: um só domínio, um só certificado, sem wildcard DNS. Trade-off aceito: tenants compartilham origem (ver item 4, isolamento).
- A raiz `conecta.com.br` (sem slug) é o **site institucional/vitrine** (fora do escopo deste ADR; é a landing de venda).

### 2. Resolução do tenant (Edge leve + camada Node autoritativa)

> **Correção (2026-07-20, kickoff do INC-014).** A redação original dizia "o middleware
> resolve slug→tenantId (com cache)". Isso ignorava que o middleware roda no **Edge Runtime
> sem acesso a banco** — o split deliberado em `src/lib/auth/edge-config.ts` (ADR-007)
> mantém Prisma/`node:crypto` fora do middleware de propósito. Resolver via Postgres no Edge
> é inviável. **O objetivo não muda** (tenant pela URL, 404 sem vazar, `set_config` pelo
> tenant da URL); muda a **camada** onde a resolução autoritativa acontece. Texto corrigido
> abaixo.

- O middleware (Edge, `middleware.ts`) extrai o primeiro segmento do path como candidato a
  slug — trabalho **puramente de string, sem banco**. Ele faz apenas a **checagem leve** de
  vínculo: compara o slug da URL com o `tenantSlug` carregado no JWT (assinado). Divergência
  ou ausência de sessão → redireciona a `/{slug}/login` (fast-fail de UX). O middleware é a
  primeira camada rápida, **não a fonte de verdade** (ADR-007).
- A **resolução autoritativa** slug → `tenantId` (com cache; slugs são estáveis), o **404
  "empresa não encontrada"** (que NUNCA vaza lista de tenants) e a governança do
  `set_config('app.tenant_id', …)` vivem na **camada Node**: o boundary do route group
  `[slug]` (Server Component) + `getActiveSession` — onde o banco já vive. O `tenantId`
  resolvido da URL alimenta `withTenant`, que o RLS já consome (ADR-003), **equality-gated**
  ao tenant da sessão autenticada (ver item 4).
- **A resolução muda de origem (URL em vez de seletor), mas o mecanismo de isolamento a
  jusante — `withTenant` + `set_config` + RLS — é o mesmo e permanece intocado.**

### 3. Login passa a ser tenant-scoped (revoga a seleção de empresa do ADR-006)
- A tela de login vive **dentro do tenant**: `/{slug}/login`. A empresa já está definida pela URL — some o seletor de empresa.
- O `authorize` (Auth.js) passa a receber o `tenantId` **da URL/contexto**, não de um campo do formulário. O CPF+senha continuam idênticos (ADR-006 item 1 permanece quanto a CPF ser a credencial); só **de onde vem o tenant** muda.
- A busca de usuário no login passa a ser `cpf_hash` **escopado ao tenant da URL** (já é assim no espírito; a diferença é a fonte do tenant).
- **Revoga:** ADR-006 item 1, especificamente a seleção de empresa via lista no login. O restante do ADR-006 (CPF hash+pepper, senha, ciclo de vida) permanece intacto.

### 4. Isolamento — o ponto crítico (não pode enfraquecer o que a auditoria confirmou sólido)
Path-based compartilha origem entre tenants (cookies/sessão na mesma origem). Salvaguardas obrigatórias:
- A **sessão carrega o `tenantId`** e é validada contra o tenant da URL em toda request. Se a sessão for de um tenant e a URL de outro (ex.: usuário logado em `/valeverde` tenta abrir `/terefrutas`), a sessão do tenant de origem **NÃO é aceita** no tenant de destino: o usuário é **redirecionado ao login do tenant da URL** (`/{slug-destino}/login`) — comportamento permissivo na navegação (leva ao lugar certo), rígido na autenticação (exige login no novo tenant; a sessão antiga não vira acesso). Decisão de Pedro sobre o caso cross-tenant. TESTE OBRIGATÓRIO: sessão do tenant A em URL do tenant B → cai no login do B, NUNCA acessa dados do B com a sessão do A.
- O RLS (ADR-003) permanece a barreira final: mesmo que algo escape na camada de aplicação, o `set_config('app.tenant_id')` + policy default-deny impedem leitura cross-tenant. A mudança de resolução **não toca** as policies nem o `withTenant`.
- O cookie de sessão deve ser escopado de forma que não permita um tenant ler/reusar o cookie de outro (path do cookie ou validação server-side do vínculo sessão↔tenant — preferir validação server-side, que já existe via tabela Session).
- **Teste de isolamento reforçado (obrigatório):** além dos testes de RLS já existentes (tenant-isolation.test.ts), adicionar testes de que (a) sessão do tenant A rejeitada em URL do tenant B; (b) slug inexistente → 404 sem vazar; (c) o tenant da URL governa o `set_config`, não um valor do cliente.

### 5. Impacto em rotas e navegação
- Todas as rotas do produto passam a viver sob `/{slug}/…` (ex.: `/{slug}/comunicados`, `/{slug}/admin/pendencias`). O route group atual `(app)` passa a ficar sob o segmento de slug.
- A navegação (ADR-009) monta os links já com o slug corrente. Nenhuma mudança de papel/autorização — só o prefixo de path.
- Links absolutos, redirects (ex.: pós-login, onboarding) e o service worker/PWA precisam considerar o slug (o `start_url` do manifest por tenant, se aplicável — avaliar no INC).

## Alternativas consideradas
- **Manter o seletor de empresa (status quo)** — funciona para 1 cliente, mas não escala para venda (expõe lista, sem endereço próprio). Rejeitada para a fase comercial.
- **Subdomínio (`empresa.conecta.com.br`)** — isolamento de origem mais forte (cookies/sessão naturalmente separados), mais "premium", mas exige wildcard DNS + certificado wildcard + mais config. Rejeitada por Pedro em favor da simplicidade do path-based; o isolamento é garantido pelas salvaguardas do item 4 + RLS.
- **Tenant em query string (`?empresa=`)** — frágil, feio, fácil de manipular/perder. Rejeitada.

## Consequências
+ Cada cliente tem endereço próprio para divulgar; nada de lista de clientes exposta.
+ Prepara personalização por tenant a partir da URL.
+ Mecanismo de isolamento a jusante (RLS/withTenant) intocado — a mudança é na resolução, não na barreira.
− Mudança de fundação: toca middleware, auth, roteamento de todas as rotas e navegação. Risco de regressão em auth/isolamento — mitigado por fazer ANTES do hardening, com teste de isolamento reforçado, e sem pressa.
− Path-based compartilha origem — exige as salvaguardas de sessão↔tenant do item 4 (validação server-side do vínculo).
− Trabalho de migração das rotas existentes para sob `/{slug}`.

## Gatilho de revisão
- Se um cliente exigir domínio próprio (`portal.empresacliente.com.br`) → domínio customizado por tenant, decisão nova (mais provável na fase enterprise).
- Se o compartilhamento de origem do path-based se provar arriscado na prática → migrar para subdomínio, decisão nova.
