# Auditoria 2026-07 — features novas (INC-014 → INC-017)

**Data:** 2026-07-27
**Escopo:** o que MUDOU desde as três auditorias anteriores (segurança/integridade,
usabilidade, LGPD, todas de 2026-07-16) — INC-014 (tenant por path), INC-015
(clube de benefícios), INC-016 (anexos no feed), INC-017 (aparência da empresa) —
e as superfícies que elas tocaram: upload, storage, resolução de tenant, escrita
em `tenants`, autorização das ações novas.
**Modo:** read-only. Nenhuma correção aplicada.
**Auditor:** Claude Code (executor), sob o prompt de auditoria do Pedro.

---

## 0. Estado da árvore no momento da auditoria

| Verificação | Resultado |
| --- | --- |
| Branch | `main` |
| INC-017 mergeado | ✅ `bd97aaf` (merge `--no-ff` de `inc-017-aparencia-da-empresa`) |
| Commits não-mergeados (`main..HEAD`) | nenhum |
| Working tree | limpo, exceto 4 arquivos **untracked** (abaixo) |
| `prisma migrate status` | ✅ *Database schema is up to date* — 15 migrations |
| `npm run lint` | ✅ sem saída |
| `npm run typecheck` | ✅ sem erros |
| `npm run test` | ✅ **266 testes / 52 arquivos**, 16s |

**Untracked (esperados, não bloqueiam a auditoria):**

- `docs/04-Roadmap/aviso-privacidade.md`, `docs/04-Roadmap/guia-conformidade-lgpd.md`
  — são exatamente os drafts que `docs/05-Decisoes-Pendentes.md:70` (G2) descreve
  como "untracked na árvore de trabalho, vão para `docs/03-LGPD/` quando
  preenchidos". Consistente com a doc.
- `public/banners/fivicon.png`, `public/banners/logo.png` — não referenciados por
  nenhum código (`grep` em `src/`). **`fivicon` parece erro de digitação de
  `favicon`.** Ver GAP-13.

Conclusão: nada de meio-de-merge. A auditoria roda sobre código fechado.

---

## 1. Isolamento multi-tenant

### 1.1 O que foi verificado direto no banco

Consulta a `pg_class` / `pg_policies` / `information_schema.table_privileges` no
banco de desenvolvimento (mesmo schema das migrations aplicadas):

**RLS — 21 tabelas:** 19 com `ENABLE` + `FORCE ROW LEVEL SECURITY` + 1 policy
`tenant_isolation` (`USING` **e** `WITH CHECK` = `tenant_id =
current_setting('app.tenant_id', true)::uuid`). As duas exceções são
`_prisma_migrations` (não é dado de domínio) e `tenants` (raiz da hierarquia,
por desenho — ADR-003).

- ✅ **`benefits` (INC-015):** `tenant_id UUID NOT NULL` + FK para `tenants`
  ON DELETE CASCADE + índice `(tenant_id, active, category, sort_order)` + RLS
  FORCE + policy com `WITH CHECK`
  (`prisma/migrations/20260723193126_inc015_benefits/migration.sql:37-63`).
  Confirmado ativo no banco. Teste de isolamento existe e passa
  (`tests/integration/benefits.test.ts:142-155`, inclui o caso `WITH CHECK`).
- ✅ **`post_media` (INC-016):** a migration só adiciona colunas
  (`kind`/`mime_type`/`original_name`/`size_bytes`) — RLS é por linha, agnóstica
  de coluna, e a policy pré-existente continua valendo
  (`20260724100000_inc016_post_media_attachments/migration.sql:1-30`). Confirmado
  no banco: `enabled=true forced=true policies=1`. Teste cobre os dois lados
  (`tests/integration/post-attachments.test.ts:81-120`).
- ✅ **`homeBannerKey` (INC-017):** coluna em `tenants`, que não tem RLS por
  desenho. O isolamento aqui não é de linha (cada tenant *é* uma linha) — é de
  aplicação. Ver 1.3.

**Nenhum caminho de leitura/escrita de domínio sem filtro de tenant.** Todo
`appDb` direto está confinado a `src/lib/repositories/tenant.repository.ts`
(6 ocorrências, todas sobre `tenants`, todas documentadas). Todo o resto passa
por `withTenant`, que valida o formato UUID e faz `set_config('app.tenant_id',
..., true)` — escopado à transação — antes do callback
(`src/lib/db/with-tenant.ts:24-34`).

**Papel de runtime:** `conecta_app` é `rolsuper=false`, `rolbypassrls=false`
(confirmado em `pg_roles`), e o boot falha se `APP_DATABASE_URL` apontar para
outra role (`src/lib/db/assert-runtime-role.ts:10-23`). A defesa RLS não é
decorativa.

### 1.2 Resolução de tenant por path (ADR-010) — Edge vs Node

O desenho está correto e a evidência bate com o ADR:

1. **Edge (`src/middleware.ts`)** só faz *transporte* e *fast-fail de UX*. O
   header `x-tenant-slug` é **sempre** reescrito a partir do valor derivado do
   path no servidor, ou removido (`src/middleware.ts:34-40`) — um
   `x-tenant-slug` injetado pelo cliente nunca sobrevive. A comparação
   slug-URL × `tenantSlug` do JWT (`:63-65`) leva ao login do tenant da URL, sem
   tocar dados.
2. **Node (`src/lib/auth/session.ts:81-100`)** é a resolução AUTORITATIVA: lê o
   header, resolve contra o banco (`getTenantBySlug` → `findActiveTenantBySlug`,
   `src/lib/tenant/resolve-tenant.ts:14-18`), `notFound()` se não existe, e só
   aceita a sessão se `session.tenantId === urlTenant.id`
   (`src/lib/tenant/tenant-access.ts:19-25`).
3. **Nenhum ponto confia só no Edge.** Todo Server Component / Server Action de
   rota de produto chama `requireSession`/`requireOnboardedSession`/
   `requireAdmin`, que derivam de `requireSessionWithSlug`.

**JWT adulterado:** um JWT com assinatura inválida é rejeitado pelo Auth.js →
sessão `null` → `sessionMatchesTenant` retorna false → redirect ao login. Um JWT
**válido** do tenant A usado numa URL do tenant B: o slug autoritativo resolve B,
a sessão é de A, não casa → login de B, sem nenhuma query no contexto de B.
E mesmo que esse guard fosse contornado, o `withTenant` de A + RLS impedem
qualquer leitura de B. Coberto por teste
(`tests/integration/tenant-path-isolation.test.ts:57-95`).

⚠️ **Nota de desenho (não é falha):** as rotas fora do subtree `[slug]` —
`/api/media/[key]`, `/api/anexo/[mediaId]`, `/api/posts/[id]/card-image` — usam
`getActiveSession()` e derivam o tenant **do JWT**, sem o cross-check com o slug
da URL (porque não há slug na URL). É consistente e seguro (o `tenantId` do JWT é
assinado, e o RLS aplica), mas significa que o "tenant da URL governa" do ADR-010
§4 não vale nessas 3 rotas — vale o "tenant do JWT". Vale registrar no ADR-010
para não virar surpresa numa auditoria futura. → **desejável**, GAP-12.

### 1.3 Namespace de storage: `branding/` e `posts/`

- ✅ **Chave sempre namespaced por tenant e derivada no servidor.** O cliente
  nunca escolhe a chave: `branding/{tenantId}/{banner|logo}/{uuid}`
  (`src/app/[slug]/(app)/admin/aparencia/actions.ts:21-26`) e
  `posts/{tenantId}/{postId}/{uuid}`
  (`src/app/[slug]/(app)/admin/posts/[id]/actions.ts:93-95`), ambos com
  `session.tenantId`.
- ✅ **O confirm revalida o prefixo** antes de gravar
  (`aparencia/actions.ts:50-54`; `posts/[id]/actions.ts:154-158`) — chave
  inesperada é apagada e rejeitada.
- ✅ **`authorizeMediaKey` compara o tenantId da chave com o da sessão**
  (`src/app/api/media/[key]/authorize.ts:20-42`): sessão do tenant B não lê nem
  escreve `branding/{A}/...` nem `posts/{A}/...`. Ver = qualquer sessão ativa do
  mesmo tenant; upload = só admin do mesmo tenant. Coberto por teste dedicado
  (`src/app/api/media/[key]/authorize.test.ts:24-60`).
- ✅ **`/api/anexo/[mediaId]`** busca o `PostMedia` sob `withTenant`, então um
  anexo de outro tenant simplesmente não é encontrado → 404
  (`src/app/api/anexo/[mediaId]/route.ts:21-24`).
- ✅ **Path traversal** no mock local: `resolveSafePath` recusa qualquer chave que
  escape de `.local-media` (`src/lib/storage/local-media-fs.ts:9-15`), e `ROOT`
  fica **fora de `public/`** (`:7`) — nunca servido estaticamente.

**Resposta direta:** não. Uma sessão do tenant A não consegue ler nem escrever
mídia do tenant B por manipulação de chave ou URL — precisaria simultaneamente de
(a) uma chave com o tenantId de B, que `authorizeMediaKey` rejeita, e (b) um HMAC
válido dessa chave, que só o servidor emite e só para chaves do próprio tenant.

### 1.4 GRANTs — princípio do mínimo

GRANTs de nível tabela para `conecta_app`, lidos do banco:

```
announcement_acks        INSERT,SELECT          announcement_audiences  DELETE,INSERT,SELECT
announcement_reads       INSERT,SELECT          announcement_sequences  INSERT,SELECT,UPDATE
announcement_versions    INSERT,SELECT          announcements           INSERT,SELECT,UPDATE
audit_logs               INSERT,SELECT          benefits                DELETE,INSERT,SELECT,UPDATE
branches                 INSERT,SELECT,UPDATE   job_applications        DELETE,INSERT,SELECT
job_openings             INSERT,SELECT,UPDATE   notifications           INSERT,SELECT,UPDATE
post_media               DELETE,INSERT,SELECT   post_people             DELETE,INSERT,SELECT
post_reactions           DELETE,INSERT,SELECT   posts                   DELETE,INSERT,SELECT,UPDATE
push_subscriptions       DELETE,INSERT,SELECT   sessions                INSERT,SELECT,UPDATE
tenants                  SELECT,UPDATE          users                   INSERT,SELECT,UPDATE
```

- ✅ **Nenhum `GRANT ALL`.** `announcement_acks`, `announcement_versions` e
  `audit_logs` continuam sem UPDATE/DELETE (imutabilidade por grant, regra 6 do
  CLAUDE.md) — **e** com trigger `BEFORE UPDATE OR DELETE` (ver 4.2).
- ✅ **`benefits` com DELETE** é decisão consciente e documentada na própria
  migration (conteúdo de marketing, não registro jurídico).
- ⚠️ **`tenants: UPDATE` é table-wide.** O INC-017 concedeu `GRANT UPDATE ON
  tenants` (`20260724170000_inc017_grant_update_tenants/migration.sql:12`) — a
  intenção documentada é "só UPDATE, nunca INSERT/DELETE", o que está correto.
  Mas UPDATE sem lista de colunas cobre **as 12 colunas**, confirmado no banco:
  `accent_color, ack_retention_months, created_at, home_banner_key, id, logo_url,
  name, plan, retention_months, slug, status, updated_at`. → **GAP-02**.

  **Raio de alcance medido empiricamente** (ensaio em transação revertida,
  assumindo a role `conecta_app` via `SET LOCAL ROLE`): hoje a role consegue
  escrever **todas as 10 colunas testadas**, incluindo `slug`, `status`, `plan`,
  `retention_months`, `name` e — o que eu não havia percebido na primeira
  passada — **`id` (a própria chave primária) e `created_at`**. Ou seja, o alcance
  é maior do que "colunas sensíveis": inclui reescrever a identidade da linha.

---

## 2. Upload / storage (superfície nova do INC-016/017)

### 2.1 Validação de tipo por magic number

| Caminho de upload | Sniff no confirm? | Evidência |
| --- | --- | --- |
| Anexo de post (INC-016) | ✅ sim | `admin/posts/[id]/actions.ts:160` → `validateUploadedObject` |
| Banner (INC-017) | ✅ sim + recusa não-imagem | `admin/aparencia/actions.ts:56-66` |
| Logo (INC-017) | ✅ sim + recusa não-imagem | idem |
| **Foto de perfil / avatar (INC-003)** | ❌ **não** | `[slug]/(app)/perfil/actions.ts:47-53` |

O sniff (`src/lib/storage/media-sniff.ts:31-45`) cobre JPEG/PNG/WEBP/PDF por
assinatura, lê 16 bytes de cabeçalho, e **o tipo gravado vem do sniff, nunca do
que o cliente declarou** (`validate-upload.ts:53`). Objeto reprovado é apagado
(`:41,:49`). Isso está correto e bem feito.

O buraco é o avatar: `confirmPhotoUploadAction` confere a chave e grava
`photoUrl` sem ler um único byte do objeto. Hoje o único filtro é o
`Content-Type` **declarado** na rota PUT do mock
(`src/app/api/media/[key]/route.ts:64-71`). Quando o R2 real entrar, o PUT vai
direto ao bucket e esse filtro **desaparece**. → **GAP-03**.

### 2.2 Presigned: expiração e quem pode gerar/usar

- ✅ **TTL de 5 minutos** (`src/lib/storage/media-storage.ts:24`), HMAC-SHA256
  com `AUTH_SECRET`, ligado a `mode` (`view`/`upload`) + `key` + `expiresAt`
  (`:32-34`), comparação em tempo constante (`:39-45`).
- ✅ **Ninguém sem sessão gera:** as três actions que emitem URL de upload são
  `requireAdmin` (branding, anexo) ou `requireOnboardedSession` (avatar).
- ✅ **Ninguém sem sessão usa:** `/api/media` GET e PUT exigem `getActiveSession()`
  **antes** de checar o token, e depois `authorizeMediaKey`
  (`route.ts:16-20, 41-45`). O token sozinho não abre nada — é a terceira camada,
  não a primeira.
- ✅ `nosniff`, CSP e `frame-ancestors 'none'` aplicados a todas as rotas
  (`next.config.ts:35-51`), incluindo `/api/media`.

### 2.3 Objetos órfãos

- ⚠️ **Janela PUT → confirm.** Se o usuário fecha a aba entre o PUT (objeto já
  gravado) e o confirm, o objeto fica no storage **para sempre**: não há linha em
  `PostMedia`/`tenants` apontando para ele e não existe nenhuma varredura. Não há
  nenhum sweep de storage no código (`src/app/api/cron/` tem só
  `anonymize-users` e `publish-announcements`). Já registrado como dívida do R2
  em `docs/05-Decisoes-Pendentes.md:61` (DP-19). → **GAP-06** (mantido, não novo).
- ⚠️ **Rascunho pristine (DP-19):** mitigado — `createOrReuseDraftAction` reusa o
  rascunho pristine mais recente do admin e apaga os extras
  (`admin/posts/actions.ts:28-39`), garantindo no máximo 1 scaffold por admin.
- 🔺 **Sub-gap NÃO registrado:** `findPristineDraftsByAdmin` exige `media: { none:
  {} }` (`src/lib/repositories/post.repository.ts:53`). Um rascunho que **recebeu
  um anexo** e foi abandonado deixa de ser pristine, **nunca é reusado nem
  apagado**, e o objeto no storage também fica. Ou seja: o pior caso do
  auto-rascunho (linha órfã + blob órfão, acumulando 1 por abandono) é
  justamente o que a mitigação não cobre. A redação do DP-19 fala em "pristine",
  então isso não está descrito. → **GAP-07**.

### 2.4 Mock local (`LocalMediaStorage`)

- ✅ **Não vaza entre tenants no disco:** o layout é `.local-media/{ns}/{tenantId}/…`
  e o diretório está fora de `public/` — o único caminho de leitura é
  `/api/media/[key]`, que autoriza por sessão + namespace + token. O `.meta.json`
  ao lado do objeto não é alcançável por chave manipulada (a regex de
  `authorizeMediaKey` não casa, e mesmo casando o `readMediaFile` do meta
  retornaria null).
- ✅ **Contrato de acesso respeitado em todos os pontos que servem mídia:** feed
  (`build-feed-view.ts:53,61`), anexo (`/api/anexo`), branding no browser
  (`branding-display.ts:15-20`), aparência (`aparencia/page.tsx:24-25`), home
  (`[slug]/(app)/page.tsx:57`). A única exceção é deliberada e correta: o PNG
  exportável embute o logo como data URI porque satori roda sem cookie
  (`branding-display.ts:28-35`).
- 🔴 **O mock não sobrevive em produção serverless** (FS efêmero/read-only). Já
  documentado como pré-requisito de produção
  (`INC-013-hardening-piloto.md:136-146`). → **GAP-01**.

### 2.5 Limites de tamanho no servidor

- ✅ **Sim, no servidor.** Guarda grossa no PUT (`route.ts:74`,
  `MAX_ANY_UPLOAD_BYTES` = 10 MB) e autoridade fina no confirm, sobre o tamanho
  **real** do objeto já gravado, por classe (imagem 5 MB / PDF 10 MB —
  `validate-upload.ts:45-51`). A validação no cliente é só feedback antecipado, e
  os comentários no código dizem isso explicitamente.
- ⚠️ **Mas a guarda grossa some com o R2.** Com presigned direto ao bucket, o PUT
  não passa pela aplicação: alguém pode empurrar um objeto de qualquer tamanho e
  só depois o confirm o apaga. O INC do R2 precisa usar presigned **POST** com
  `content-length-range`, não presigned PUT. → **GAP-08**.
- ⚠️ **Sem rate limit nos uploads.** `src/lib/security/rate-limit.ts` existe e é
  usado só no login (`[slug]/login/actions.ts:14,30`). Um admin autenticado pode
  emitir URLs e gravar objetos sem teto. Combinado com a ausência de sweep, é um
  vetor de custo de storage. Severidade baixa (exige admin). → **GAP-11**.

---

## 3. Autorização / papéis

- ✅ **Todo `/admin` exige `requireAdmin`, duas vezes.** O layout do subtree
  (`src/app/[slug]/(app)/admin/layout.tsx:4`) cobre todas as páginas, e **cada
  action** chama `requireAdmin` por conta própria. Levantamento completo (14
  arquivos de action + 2 route handlers sob `/admin`): 100% com `requireAdmin`.
- ✅ **As actions novas validam papel E tenant.** Benefícios
  (`beneficios/novo/actions.ts:17`, `beneficios/[id]/actions.ts:17,59,81`),
  aparência (`aparencia/actions.ts:32,45,104`), anexos
  (`posts/[id]/actions.ts:37,120,153,198`) — todas `requireAdmin` **e** todas
  usam `session.tenantId`, nunca um `tenantId` vindo do formulário. Nenhum
  endpoint aceita `tenant_id` do cliente (regra 7 do CLAUDE.md: cumprida).
- ✅ **Colaborador não chama action de admin.** `requireAdmin` →
  `requireOnboardedSession` → redirect `/403` se `role !== "admin"`
  (`session.ts:118-123`). Cobre a chamada direta ao endpoint de Server Action,
  não só a navegação. Coberto por teste
  (`tests/integration/admin-guard-authorization.test.ts:69-110`).
- ✅ **Actions chamadas fora de `<form>`** (`requestBrandingUploadUrl`,
  `updateAccentColorAction`, `confirmPostAttachmentUploadAction`) são endpoints
  como qualquer outra — todas com guard na primeira linha. Correto.
- ✅ Rotas de mídia autorizam por namespace além da sessão (ver 1.3).

**Nenhum achado nesta área.**

---

## 4. Integridade / consistência

### 4.1 Migrations manuais (ADR-008)

- ✅ `prisma migrate status`: *Database schema is up to date*, 15 migrations.
- ✅ **Drift real: nenhum.** `prisma migrate diff --from-schema-datasource
  --to-schema-datamodel` acusa **só** o ruído conhecido e documentado do
  `search_vector`:

  ```
  [*] Changed the `announcement_versions` table
    [-] Removed index on columns (search_vector)
    [*] Altered column `search_vector` (default changed from Some(DbGenerated(...)) to None)
  ```

  É exatamente o que o ADR-008 descreve (Prisma não representa coluna GENERATED),
  e é o mesmo ruído que as três migrations novas removeram à mão — cada uma diz
  isso no cabeçalho (`inc015_benefits:1-9`, `inc016_post_media:8-12`,
  `inc017_tenant_home_banner_key:4-5`). Nenhuma coluna, índice ou constraint do
  `schema.prisma` está faltando na migration, nem vice-versa.

### 4.2 Triggers de imutabilidade

✅ **Intactos após as mudanças.** Lidos de `information_schema.triggers`:

```
announcement_acks      announcement_acks_no_update_delete       BEFORE UPDATE / BEFORE DELETE
announcement_versions  announcement_versions_no_update_delete   BEFORE UPDATE / BEFORE DELETE
audit_logs             audit_logs_no_update_delete              BEFORE UPDATE / BEFORE DELETE
```

Nenhuma das migrations novas toca essas tabelas. Dupla defesa (trigger + ausência
de GRANT) preservada. Teste `immutability-triggers` passa.

### 4.3 Anonimização (G1) com as entidades novas

- ✅ **Não quebra.** `anonymizeUser` é um `UPDATE` sobre `users`
  (`user.repository.ts:218-233`), não um DELETE — então a FK
  `Benefit.createdBy → User` com `onDelete: Restrict`
  (`schema.prisma:578`) **não é acionada**. Um desligado que criou benefícios é
  anonimizado normalmente; os benefícios permanecem (conteúdo da empresa, não do
  indivíduo), com `created_by` apontando para o registro já anonimizado.
- ✅ Posts e anexos não têm vínculo por-usuário que quebre: `PostMedia` não tem
  autor, e `Post.createdBy` também é só uma FK sem cascade destrutivo.
- ⚠️ **Órfãos:** a anonimização anula `photoUrl` mas não apaga o objeto —
  pendência LGPD já registrada e travada no INC do R2
  (`INC-013-hardening-piloto.md:103-110`, `media-storage.ts:77-82`). **Branding e
  anexos não entram nessa conta** (não são dado pessoal do titular; são conteúdo
  do tenant). Nada novo a registrar aqui.
- 🔺 **Nota LGPD (não é regressão, é ampliação de superfície):** um anexo PDF de
  post pode conter dado pessoal do colaborador (holerite, comunicado nominal,
  lista). A anonimização não varre conteúdo de post — nunca varreu (título/corpo
  já tinham o mesmo problema), mas o INC-016 aumentou a chance de isso acontecer,
  porque agora dá para subir documento. Vale uma linha no guia de conformidade
  orientando o admin. → **GAP-10**.

---

## 5. Erros / UX / robustez

### 5.1 Mensagens honestas

- ✅ **O uploader de aparência (INC-017) é o padrão a seguir.** Cada etapa tem
  mensagem própria, e o comentário no código explica por quê
  (`appearance-uploader.tsx:62-67`): "um 500 de servidor não é um problema de
  formato — dizer 'envie JPG/PNG' mandaria o usuário pro caminho errado, como já
  custou tempo no INC-017". Erro de preparo (`:72`), de rede/PUT (`:82`), de
  servidor no confirm (`:90`) e de validação real (`:94`) são distintos.
- ⚠️ **O uploader de anexos (INC-016) faz exatamente o que o INC-017 corrigiu.**
  `photo-upload.tsx:101-103` engole qualquer exceção das três etapas
  (`requestPostAttachmentUploadUrl`, PUT, `confirm`) num único `"erro no envio"`,
  e `uploadWithProgress` rejeita com `new Error("upload falhou")` sem status HTTP
  (`:37-38`). Um 500 de banco e um 413 de tamanho chegam ao admin com o mesmo
  texto. → **GAP-05**.
- ⚠️ `photo-upload.tsx:192` usa `<p className="text-xs text-destructive">` sem
  `role="alert"`; o de aparência usa `role="alert"`/`role="status"`
  (`appearance-uploader.tsx:137-138`). Inconsistência de acessibilidade.
  → parte do GAP-05.

### 5.2 Error boundaries

⚠️ Só existe `src/app/error.tsx` (raiz). **Não há `error.tsx` no subtree
`[slug]`** — um erro numa tela de tenant sobe até o boundary global, que
renderiza sem o shell de navegação do tenant, deixando o usuário sem saída a não
ser recarregar. `src/app/[slug]/not-found.tsx` existe e está em pt-BR
(bom). → **GAP-09**.

### 5.3 Estados vazios, loading, confirmações destrutivas

- ✅ Benefícios do colaborador: `EmptyState` com texto pt-BR adequado
  (`[slug]/(app)/beneficios/page.tsx:34-39`).
- ⚠️ Benefícios do **admin**: `<p className="text-meta text-muted-foreground">
  Nenhum benefício cadastrado ainda.</p>` cru
  (`admin/beneficios/page.tsx:49-50`) — não usa `EmptyState`, ao contrário da tela
  do colaborador e do que o design-system pede (R26 da auditoria de usabilidade).
  → **GAP-13**.
- ✅ Confirmações destrutivas: remover benefício (`ConfirmDialog`,
  `admin/beneficios/[id]/page.tsx`) e remover anexo (`photo-upload.tsx:120-129,
  151-160`). Ativar/desativar benefício sem confirmação — correto, é reversível.
- ✅ Loading: `src/app/loading.tsx` na raiz cobre o subtree.
- ⚠️ **Aparência não tem como REMOVER banner/logo.** Uma vez configurado, o admin
  só consegue *trocar* (`aparencia/page.tsx:58,73` — os rótulos são "Trocar
  banner"/"Trocar logo"). Não há caminho de volta para a arte padrão. O
  repositório já suporta (`TenantAppearanceUpdate` aceita `null`,
  `tenant.repository.ts:72-76`) — falta só a ação e o botão. → **GAP-04**.

### 5.4 Alvos de toque ≥48px em 360px

- ✅ **Bottom nav com 5 itens está OK.** `min-h-12` = 48px de altura, `flex-1` dá
  ~72px de largura por item a 360px (`src/components/ui/bottom-nav.tsx:40`). O
  aperto foi para o rótulo (`text-[0.625rem]` = 10px + `truncate`), não para o
  alvo. Decisão consciente registrada no código
  (`app-bottom-nav.tsx:16-23`). Aceitável.
- ⚠️ **Remoção de anexo fura o mínimo:** o "×" da imagem é `size-5` = **20px**
  (`photo-upload.tsx:123`) e o "Remover" do documento é `px-2 py-1 text-xs` ≈
  **24px de altura** (`:154`). São alvos destrutivos, pequenos e sobrepostos ao
  thumbnail — o pior caso para o polegar. É admin, não colaborador, mas o admin
  também usa celular. → **GAP-05** (mesma família).
- ✅ Aparência usa `size="touch"` (48px, `appearance-uploader.tsx:122`) e o
  seletor de cor tem `h-11` (44px, `accent-color-field.tsx:51` — 4px abaixo, mas
  é um `<input type="color">` nativo).
- ⚠️ Anexos usa `size="sm"` (28px) no "Enviar anexos" (`photo-upload.tsx:169`)
  enquanto aparência usa `size="touch"`. Divergência de padrão entre dois INCs
  consecutivos que fazem a mesma coisa. → parte do GAP-05.

---

## 6. Consistência de código / dívida

### 6.1 Aderência aos padrões dos INCs anteriores

✅ **As features novas seguem o padrão.** Todas as três usam a mesma tríade:
repositório puro recebendo `tx` → action com guard + `withTenant` → `recordAuditLog`
na mesma transação. Verificado em benefícios
(`benefit.repository.ts` + `beneficios/*/actions.ts`), aparência
(`tenant.repository.ts:78-84` + `aparencia/actions.ts:69-85`) e anexos
(`post.repository.ts` + `posts/[id]/actions.ts:165-186`). Auditoria registrada em
todas as escritas novas (`benefit.create/update/activate/deactivate/delete`,
`tenant.appearance.update`, `post.media.add`).

Divergências encontradas: só as de UI do GAP-05 e GAP-13. Nada arquitetural.

### 6.2 Flakiness

✅ **Não reproduzida.** Os dois suspeitos conhecidos (`immutability-triggers`,
`pending-count-badge`) mais os três de features novas rodaram **5× seguidas**:
5/5 verdes, 16 testes por rodada, zero falhas. A suíte completa (266 testes)
também passa. **Não há teste flaky a estabilizar hoje** — se a instabilidade era
real, foi resolvida sem registro. Recomendo remover a menção de flakiness das
pendências ou trocá-la por "não reproduzida em 2026-07-27, reabrir se voltar".

> ### ⚠️ Correção posterior — 2026-08-05 (GAP-15)
>
> **A conclusão acima estava errada.** O achado original fica como está (é o
> registro fiel do que 5 rodadas mostraram em 2026-07-27), mas a recomendação
> de "remover a menção de flakiness das pendências" **não** deve ser seguida: o
> problema reincidiu **duas vezes** desde então, e agora com mecanismo
> identificado.
>
> - **INC-023 (2026-08-04):** reproduzido em 1 de 2 rodadas paralelas, na linha
>   de base, antes de qualquer mudança do INC.
> - **INC-024 (2026-08-05):** reproduzido de novo em `immutability-triggers.test.ts`.
>
> **Mecanismo:** o `TRUNCATE … CASCADE` da limpeza de teste pede
> `AccessExclusiveLock`; um `INSERT` concorrente de outro arquivo de teste
> segura `RowExclusiveLock` na mesma tabela; sob execução paralela do vitest os
> dois se cruzam e o Postgres aborta um deles com **`40P01 deadlock detected`**.
> Não é teste "instável" no sentido de código não-determinístico — é contenção
> de lock entre arquivos, e não reproduzir em 5 rodadas seriais é esperado.
>
> Isso muda a natureza do item: de "registro desatualizado, atualizar a doc"
> para **problema aberto com causa conhecida**. O registro atual e completo é a
> **DP-35** em `docs/05-Decisoes-Pendentes.md` — inclusive a lista das tabelas
> hoje nessa condição. Duas ressalvas de nomenclatura, para quem cruzar as
> fontes: (a) no texto desta auditoria "GAP-15" nomeia *o registro estar
> desatualizado*, não o deadlock em si — a equação "GAP-15 = deadlock 40P01"
> nasceu no registro do INC-023 e ficou; (b) `pending-count-badge`, o segundo
> suspeito citado aqui, não voltou a falhar — as duas reincidências foram em
> `immutability-triggers`.

### 6.3 `npm audit`

🔴 **18 vulnerabilidades (2 críticas, 13 altas, 3 moderadas).** As que importam:

| Pacote | Sev. | Advisory | Correção |
| --- | --- | --- | --- |
| `next-auth` / `@auth/core` | **crítica** | GHSA-8fpg-xm3f-6cx3 — *erros de configuração fazem checagens de auth baseadas em existência **falharem abertas*** (objeto `auth` populado com erro) | `next-auth@5.0.0-beta.32` |
| `next-auth` / `@auth/core` | **crítica** | GHSA-7rqj-j65f-68wh — normalizador de e-mail permite bypass por homóglifo de `@` | idem |
| `@auth/core` | alta | GHSA-xmf8-cvqr-rfgj — `getToken()` lança exceção não-tratada com header `Bearer` malformado | idem |
| `next` 16.2.10 | alta | **GHSA-6gpp-xcg3-4w24 — bypass de Middleware/Proxy em App Router com Turbopack** | `next@16.2.12` |
| `next` 16.2.10 | alta | GHSA-89xv-2m56-2m9x / GHSA-p9j2-gv94-2wf4 — SSRF em Server Actions / rewrites | idem |
| `next` 16.2.10 | alta | GHSA-m99w-x7hq-7vfj — DoS em Server Actions | idem |
| `next` 16.2.10 | moderada | GHSA-955p-x3mx-jcvp — divulgação não-autenticada de endpoints de Server Function | idem |
| `postcss`, `sharp` | alta | transitivos de `next` | idem (`next@16.2.12`) |
| `eslint*` | alta | só devDependency (não vai a produção) | `eslint@10.8.0` (breaking) |

Duas observações de análise, não de scanner:

1. **O bypass de middleware do Next NÃO quebra o isolamento de tenant aqui** — e
   isso é mérito do desenho em camadas. Se o middleware for contornado, o header
   `x-tenant-slug` deixa de ser reescrito; o pior caso é o cliente injetar
   `x-tenant-slug: outro-tenant`, e aí `requireSessionWithSlug` resolve o outro
   tenant, `sessionMatchesTenant` falha e redireciona ao login. Sem header
   nenhum, `notFound()`. O ADR-010 §2 ("a resolução autoritativa está no Node")
   é exatamente o que salva. **Ainda assim o upgrade é obrigatório** — as outras
   falhas do mesmo pacote (SSRF, DoS, exposição de endpoints) não têm essa rede.
2. **O "fail open" do Auth.js (crítica) é o mais grave da lista** para este
   produto: toda a cadeia começa em `auth()` (`session.ts:38`). Um erro de
   configuração que popule o objeto de auth com erro em vez de falhar fechado
   ataca a raiz. A correção é um bump de beta (`beta.31 → beta.32`).

→ **GAP-01a** (`next`) e **GAP-01b** (`next-auth`).

### 6.4 Design-system

✅ **Sem divergência.** Varredura de todos os usos de `--action` em `src/`: o
laranja aparece só em pendência/ação (banner de pendência, badge de contagem,
percentual de pendência, CTA de candidatura, chip de agendado) e nos badges de
categoria (`badge.tsx:23-24`), que é a decisão do Pedro de 2026-07-18 registrada
no próprio código. Nenhum uso decorativo novo. Figtree via `@fontsource/figtree` +
`next/font`, sem CDN. `HomeBanner`, `Badge`, `EmptyState`, `ConfirmDialog`,
`Button` reusados pelas telas novas.

⚠️ **Uma brecha nova, porém:** `accentColor` é validado só como hex `#RRGGBB`
(`aparencia/actions.ts:95,107`) e depois usado **como cor de texto sobre fundo
claro** (`card-shell.tsx:44`) e como chip `{cor}1F` de fundo + `{cor}` de texto
(`:40`). O admin pode escolher `#FFFF00` (ilegível) ou um laranja que colide com
a regra de ouro do design-system. **O DP-15 pedia explicitamente "validação de
contraste AA contra `--background`/`--card`"** (`05-Decisoes-Pendentes.md:55`) e
isso não foi implementado. → **GAP-04**.

### 6.5 Um bug concreto herdado, que o INC-017 quase corrigiu

⚠️ O INC-017 identificou e resolveu, para o logo, que **satori roda sem cookie**,
então uma URL assinada de `/api/media` não serve no PNG exportável — por isso
`inlineBrandingLogoForExport` embute o logo como data URI
(`branding-display.ts:28-35`). **A foto das pessoas no mesmo card não recebeu esse
tratamento**: `withAbsoluteMediaUrls` transforma o `photoUrl` assinado em URL
absoluta (`absolute-urls.ts:26`) e `AvatarNode` a coloca num `<img src>`
(`avatar-node.tsx:17-27`) que satori vai buscar por `fetch` **sem cookie** →
`/api/media` responde 401 (`route.ts:17`).

Efeito esperado em `/api/posts/{id}/card-image` para um post cuja pessoa marcada
**tem foto**: satori falha ao carregar a imagem — na melhor hipótese o avatar sai
vazio, na pior a rota devolve 500. É pré-existente do INC-009, mas é a mesma
classe de bug que o INC-017 documentou e corrigiu ao lado, no mesmo arquivo.
→ **GAP-05a**. *Verificar manualmente* (ver seção 8).

---

## 7. Reconciliação com as pendências documentadas

| Pendência | Estado real no código | Ação |
| --- | --- | --- |
| **DP-19** auto-rascunho | Aberta, mitigada como descrito. **Mas** a mitigação não cobre rascunho **com anexo** abandonado (`post.repository.ts:53`) | GAP-07 — corrigir a redação do DP-19 |
| **DP-15** tela de logo/cor | ✅ Resolvida pelo INC-017 — **exceto** a cláusula de validação de contraste AA, que o DP-15 exigia explicitamente | GAP-04 — DP-15 não deve ser fechado ainda |
| **R2 pré-produção** | Aberta, corretamente documentada em 3 lugares (roadmap:36-37, INC-013:136-146, INC-017:171-175). Confirmado no código: mock em FS local, inviável em serverless | GAP-01 — sem novidade |
| **G2** aviso de privacidade | Aberta; os drafts untracked na árvore batem com a descrição | nada a fazer |
| **G3** teste de restore / **M2** backup / **M3** região | Abertas, externas ao código | verificar manualmente |
| **Medição de push em iPhone** | Aberta (roadmap:31) | verificar manualmente |
| **QA de formatos** (jpg/png/webp/pdf reais) | Coberto por teste unitário do sniff (`media-sniff.test.ts`) e por `validate-upload.test.ts`, mas **não** por QA manual com arquivos reais ponta a ponta | verificar manualmente |
| **Deprecação `middleware.ts` → `proxy.ts`** | **Aberta e não registrada em doc nenhuma** (`grep` por "proxy" em `docs/` não retorna nada ligado a middleware). O arquivo segue `src/middleware.ts` | GAP-14 — registrar |
| **Flakiness** (immutability-triggers, pending-count-badge) | **Não reproduzida** em 5 rodadas | GAP-15 — atualizar/remover o registro |
| **Purga de blob na anonimização** | Aberta, corretamente registrada | sem novidade |

> **Correção — 2026-08-05:** a linha de flakiness acima **não** se sustentou. O
> deadlock `40P01` reincidiu no INC-023 (2026-08-04) e no INC-024 (2026-08-05),
> com mecanismo identificado; o registro deve ser **reaberto**, não removido.
> Ver a nota completa em §6.2 e a **DP-35** em `docs/05-Decisoes-Pendentes.md`.
> Por consequência, o "resolvido sem registro" logo abaixo também não vale para
> a flakiness.

**Resolvido sem registro:** a flakiness (6.2). **Gap novo relacionado a pendência
existente:** GAP-07 (DP-19 incompleto) e GAP-04 (DP-15 fechado cedo demais).

---

## 8. Itens que dependem de plataforma — **verificar manualmente**

O que o Pedro precisa checar fora do código:

1. **Neon — backups automáticos ativos e cifrados** (M2, pré-requisito do G3).
   Painel do Neon → Backups.
2. **Neon + Vercel — região da infra** (M3). Se rodar fora do Brasil, o G2 precisa
   declarar transferência internacional (LGPD Art. 33).
3. **Vercel — variáveis de ambiente de produção.** Confirmar que
   `APP_DATABASE_URL` aponta para `conecta_app` (não para a role owner) — o boot
   check quebra se estiver errado (`assert-runtime-role.ts`), mas é melhor
   descobrir antes do deploy que depois. Confirmar também `AUTH_SECRET` e
   `CPF_PEPPER` presentes e distintos dos de dev.
4. **Cloudflare R2 — bucket, credenciais e política de CORS** (GAP-01). Quando
   criar: bucket **privado**, sem acesso público, CORS restrito à origem da app.
5. **Push em iPhone** — medição real pendente do INC-012 (roadmap:31).
6. **QA de formatos ponta a ponta:** subir um JPG, um PNG, um WEBP e um PDF reais
   como anexo e como banner/logo, e um arquivo renomeado (ex.: `.exe` renomeado
   para `.png`) para confirmar que o sniff rejeita. O teste unitário cobre a
   função; falta o caminho completo pelo navegador.
7. **Reproduzir o GAP-05a:** abrir um post de reconhecimento cuja pessoa marcada
   **tenha foto de perfil** e clicar em "baixar card". Confirmar se a imagem sai
   sem avatar ou se a rota devolve 500.

---

## GAPS REAIS — consolidado e priorizado

Só o que de fato precisa de ação. Esforço: **P** ≈ até 2h · **M** ≈ meio dia ·
**G** ≈ INC próprio.

### 🔴 Bloqueia

| # | Gap | Evidência | Esforço |
| --- | --- | --- | --- |
| **GAP-01b** | **`next-auth`/`@auth/core` com 2 CVEs críticos**, incluindo *fail open* em checagens de auth por erro de configuração (GHSA-8fpg-xm3f-6cx3) — ataca a raiz da cadeia de sessão | `package.json:"next-auth": "5.0.0-beta.31"`; `src/lib/auth/session.ts:38` | **P** (bump para `beta.32` + rodar a suíte) |
| **GAP-01a** | **`next` 16.2.10 com 4 CVEs altos**: bypass de middleware, 2× SSRF em Server Actions/rewrites, DoS. O bypass de middleware **não** quebra o isolamento de tenant (o Node é autoritativo), mas os outros não têm rede | `package.json:"next": "16.2.10"`; audit → `next@16.2.12` | **P** (patch release) |
| **GAP-01** | **R2 não ativado.** Sem ele, banner, logo, anexos e avatar não funcionam em produção serverless (FS efêmero). Carrega junto: sweep de órfãos (GAP-06/07), `delete(key)` na anonimização, presigned POST com limite (GAP-08), staging do DP-19 | `src/lib/storage/media-storage.ts:83`; `local-media-fs.ts:7`; `INC-013:136-146` | **G** (INC próprio) |

### 🟠 Importante

| # | Gap | Evidência | Esforço |
| --- | --- | --- | --- |
| **GAP-02** | **`GRANT UPDATE ON tenants` é table-wide** — cobre as 12 colunas, inclusive `slug`, `status`, `plan`, `retention_months`, **`id` e `created_at`** (medido, ver 1.4). `tenants` **não tem RLS** (por desenho), então a única barreira contra escrita cross-tenant ou em coluna sensível é a disciplina da camada de app. Um bug futuro que passe um id de formulário não teria backstop | `20260724170000_inc017_grant_update_tenants/migration.sql:12`; colunas confirmadas no banco; `tenant.repository.ts:78-84` | **P** — ver a migration verificada em §9 (**4 colunas, não 3**) + teste negativo |
| **GAP-03** | **Avatar é o único upload sem sniff de magic number.** `confirmPhotoUploadAction` grava `photoUrl` sem ler um byte. Hoje o mock filtra pelo Content-Type **declarado**; com o R2 esse filtro some | `[slug]/(app)/perfil/actions.ts:47-53` vs. `aparencia/actions.ts:56` e `posts/[id]/actions.ts:160` | **P** — chamar `validateUploadedObject` + recusar não-imagem (5 linhas, o padrão já existe em 2 lugares) |
| **GAP-04** | **Aparência incompleta em duas frentes:** (a) sem validação de contraste AA da cor de destaque, que o **DP-15 exigia explicitamente** — o admin pode escolher amarelo ilegível ou um laranja que viola a regra de ouro; (b) sem como **remover** banner/logo e voltar à arte padrão | (a) `aparencia/actions.ts:107` só valida hex; usado como cor de texto em `card-shell.tsx:40,44`; requisito em `05-Decisoes-Pendentes.md:55` — (b) `aparencia/page.tsx:58,73`, o repositório já aceita `null` (`tenant.repository.ts:72-76`) | **M** (a: função de contraste + aviso na UI; b: action + botão) |
| **GAP-05** | **O uploader de anexos (INC-016) repete o anti-padrão que o INC-017 corrigiu ao lado:** erro genérico `"erro no envio"` para as 3 etapas, sem status HTTP; `<p>` de erro sem `role="alert"`; alvos destrutivos de **20px** e **24px**; `size="sm"` onde aparência usa `size="touch"` | `photo-upload.tsx:37-38, 101-103, 123, 154, 169, 192` — comparar com `appearance-uploader.tsx:62-96, 122, 137-138` | **M** — portar o tratamento de erro do INC-017 e subir os alvos |
| **GAP-05a** | **Foto de pessoa quebra no card exportável.** satori roda sem cookie; o logo foi corrigido com data URI no INC-017, o `photoUrl` não — vira URL absoluta de `/api/media`, que responde **401** ao fetch de satori. Avatar vazio ou 500 na rota | `absolute-urls.ts:26` → `avatar-node.tsx:17-27` → `route.ts:17`; correção análoga já existe em `branding-display.ts:28-35` | **P** — aplicar a mesma técnica de inline (data URI) ao `photoUrl` no caminho de export |
| **GAP-07** | **DP-19 não cobre o pior caso.** A limpeza de auto-rascunho exige `media: { none: {} }` — um rascunho **com anexo** abandonado nunca é reusado nem apagado: acumula linha órfã **e** blob órfão, 1 por abandono | `src/lib/repositories/post.repository.ts:53`; redação do DP-19 em `05-Decisoes-Pendentes.md:61` | **P** para corrigir a doc; a correção real entra no GAP-01 (R2/staging) |
| **GAP-08** | **Limite de tamanho depende da guarda que o R2 vai remover.** Hoje o PUT no mock corta em 10 MB; com presigned PUT direto ao bucket, qualquer tamanho entra e só o confirm apaga depois. O INC do R2 precisa usar **presigned POST com `content-length-range`** | `src/app/api/media/[key]/route.ts:74` (guarda que some); `validate-upload.ts:45-51` (autoridade pós-fato) | requisito **do** GAP-01, registrar agora |

### 🟡 Desejável

| # | Gap | Evidência | Esforço |
| --- | --- | --- | --- |
| **GAP-06** | Objetos órfãos da janela PUT→confirm: sem sweep, sem TTL de bucket | nenhum cron de storage em `src/app/api/cron/`; DP-19 já registra | entra no GAP-01 |
| **GAP-09** | Sem `error.tsx` no subtree `[slug]` — erro de tela de tenant cai no boundary global, sem o shell de navegação | só `src/app/error.tsx` existe; `[slug]/not-found.tsx` existe e está OK | **P** |
| **GAP-10** | Anexo PDF pode conter dado pessoal e a anonimização não varre conteúdo de post. Não é regressão (título/corpo sempre tiveram), mas o INC-016 ampliou a superfície | `anonymize-sweep.ts` só toca `users`; `post_media` intocado | **P** — uma orientação no guia de conformidade |
| **GAP-11** | Sem rate limit nas actions de upload — admin autenticado emite URLs e grava objetos sem teto | `rate-limit.ts` usado só em `login/actions.ts:14,30` | **P** |
| **GAP-12** | ADR-010 não menciona que 3 rotas fora de `[slug]` (`/api/media`, `/api/anexo`, `/api/posts/[id]/card-image`) derivam o tenant do **JWT**, não da URL. Seguro, mas não documentado | `route.ts:16`, `anexo/route.ts:18`, `card-image/route.ts:26` | **P** — parágrafo no ADR-010 |
| **GAP-13** | Inconsistências menores: empty state do admin de benefícios é `<p>` cru em vez de `EmptyState`; `public/banners/fivicon.png` e `logo.png` untracked e não referenciados (`fivicon` = typo de `favicon`?) | `admin/beneficios/page.tsx:49-50` vs. `[slug]/(app)/beneficios/page.tsx:34-39` | **P** |
| **GAP-14** | Deprecação `middleware.ts` → `proxy.ts` (Next 16) não está registrada em nenhuma doc | `grep -rn "proxy" docs/` não retorna nada ligado a middleware; `src/middleware.ts` em uso | **P** — registrar como DP |
| **GAP-15** | O registro de flakiness está desatualizado: 5 rodadas dos suspeitos = 5/5 verdes | `immutability-triggers` + `pending-count-badge` + 3 novos, 16 testes × 5 | **P** — atualizar a doc |

> **Correção — 2026-08-05 (GAP-15):** o diagnóstico desta linha está invertido.
> Não era o registro de flakiness que estava desatualizado — era esta auditoria.
> O deadlock `40P01` reincidiu duas vezes (INC-023 em 2026-08-04, INC-024 em
> 2026-08-05), com mecanismo identificado (`TRUNCATE CASCADE` vs. `INSERT`
> concorrente sob vitest paralelo). A ação correta não é "atualizar a doc" e sim
> tratar o problema; ele está rastreado na **DP-35** de
> `docs/05-Decisoes-Pendentes.md`. Nota completa em §6.2.

---

## Proposta de ordem de correção

**Bloco 1 — segurança de dependência (faça primeiro, é barato e ataca a raiz).**
GAP-01b + GAP-01a. Dois bumps: `next-auth@5.0.0-beta.32` e `next@16.2.12`, ambos
patch/beta-patch, seguidos de `lint && typecheck && test`. Fecha 2 críticos e 4
altos numa tarde. Nada mais compete com isso em relação custo/risco.

**Bloco 2 — o que é barato e fecha buraco real de código (½ dia).** Nesta ordem:
GAP-03 (sniff no avatar — 5 linhas, o padrão já existe), GAP-05a (data URI no
`photoUrl` do export — correção análoga já escrita ao lado), GAP-02 (**a migration
de 4 colunas de §9** + teste negativo). Os três são pequenos, testáveis, e cada um
remove uma dependência de disciplina humana. Para o GAP-02, o SQL e o teste já
estão verificados em §9 — **não use a versão de 3 colunas**, ela quebra a tela de
Aparência com 42501.

**Bloco 3 — reconciliação de documentação (1–2h, sem código).** GAP-07 (redação do
DP-19), GAP-04 parte (a) reabrindo formalmente o DP-15, GAP-08 (registrar o
requisito de presigned POST **antes** de escrever o INC do R2, senão ele nasce
errado), GAP-12, GAP-14, GAP-15. Fazer isto **antes** do Bloco 4 — é o que impede
o INC do R2 de esquecer metade das dívidas que dependem dele.

**Bloco 4 — INC de polimento (1 dia).** GAP-04 (contraste AA + remover
banner/logo), GAP-05 (erros honestos + alvos de toque nos anexos), GAP-09
(`error.tsx` no `[slug]`), GAP-13. Tudo UI, tudo de baixo risco, tudo verificável
no navegador.

**Bloco 5 — INC do R2 (o grande).** GAP-01, absorvendo GAP-06, GAP-07 (staging por
sessão), GAP-08, GAP-11 e a purga de blob na anonimização (INC-013 G1). É
pré-requisito de produção e o item mais caro; entrar nele só depois do Bloco 3,
com a lista de dívidas já consolidada.

---

## 9. GAP-02 — migration verificada (correção da proposta original)

**A proposta original desta auditoria estava errada: 3 colunas quebram a
feature.** Correção apontada pelo Pedro e confirmada empiricamente.

### Por que 3 colunas não funcionam

`Tenant.updatedAt` tem `@updatedAt` (`prisma/schema.prisma:132`), então o Prisma
**injeta `updated_at` no SET de todo `tenant.update`**. O statement real, capturado
do log de query do Prisma:

```sql
UPDATE "public"."tenants" SET "home_banner_key" = $1, "updated_at" = $2
WHERE ("public"."tenants"."id" = $3 AND 1=1) RETURNING …
```

Com `GRANT UPDATE (home_banner_key, logo_url, accent_color)`, o Postgres nega o
statement **inteiro** por falta de privilégio em `updated_at` — verificado:

```
3 colunas -> NEGADO  SQLSTATE=42501  ERROR: permission denied for table tenants
4 colunas -> PASSOU
```

É o **mesmo 42501** que morde e que no INC-017 foi confundido com erro de formato.
Um grant de 3 colunas transformaria o backstop do GAP-02 em quebra da própria
feature que ele deveria proteger.

*(Nota: o `RETURNING` do Prisma lê as 12 colunas, mas `conecta_app` tem `SELECT`
em todas — então o grant por coluna no UPDATE não afeta o retorno.)*

### Pré-requisito: nada mais escreve em `tenants` pela app

Verificado no código (é onde mora a verdade — o banco só diz o que a role *pode*
escrever, não o que a app escreve):

| Verificação | Resultado |
| --- | --- |
| `.tenant.(update\|updateMany\|upsert\|create\|createMany)` em `src/` | **1 hit**: `tenant.repository.ts:83` (`tx.tenant.update`) |
| SQL cru `UPDATE tenants SET` / `INSERT INTO tenants` em `src/` | **0 hits** |
| Arquivos com `appDb` **e** `.tenant.` | apenas `tenant.repository.ts` (6 leituras + 1 escrita) |
| Callers de `updateTenantAppearance` | 2, ambos em `aparencia/actions.ts:75,112`, passando só `homeBannerKey` \| `logoUrl` \| `accentColor` |
| Writes em `tenant` fora de `src/` | 3, todos via **role owner** (`ownerDb`/`db` = `DATABASE_URL`): `tenant-resolution.test.ts:34`, `tenant-appearance.test.ts:27`, `seed-data.ts:39` — não passam por `conecta_app`, não afetam o grant |

**Conclusão:** `name`, `status`, `plan`, `retention_months`, `ack_retention_months`
**não têm nenhum write via `conecta_app`**. Não existe tela de "configurações da
empresa", mudança de plano ou ajuste de retenção na aplicação — tudo isso é
operação de owner/seed. **O grant de 4 colunas é seguro.**

### A migration

```sql
-- INC-0XX (GAP-02 da auditoria 2026-07): reduz o GRANT UPDATE em `tenants` do
-- INC-017 ao minimo real. tenants NAO tem RLS (raiz da hierarquia), entao o
-- grant por coluna e' o unico backstop de banco possivel aqui.
--
-- updated_at ENTRA na lista por necessidade tecnica, nao por escolha: Tenant tem
-- `updatedAt @updatedAt` (schema.prisma:132), logo o Prisma injeta `updated_at`
-- no SET de todo tenant.update. Sem ele o Postgres nega o statement inteiro com
-- 42501 e a tela de Aparencia para de salvar. Verificado empiricamente.
--
-- Fora da lista (e' o ponto): id, created_at, slug, status, plan,
-- retention_months, ack_retention_months, name — nenhuma tem write pela app.
REVOKE UPDATE ON tenants FROM conecta_app;
GRANT UPDATE (home_banner_key, logo_url, accent_color, updated_at) ON tenants TO conecta_app;
```

### Verificação antes/depois

```sql
-- ANTES: UPDATE table-wide aparece aqui
SELECT privilege_type FROM information_schema.role_table_grants
WHERE grantee = 'conecta_app' AND table_name = 'tenants';

-- DEPOIS: exatamente 4 linhas
SELECT column_name, privilege_type FROM information_schema.column_privileges
WHERE grantee='conecta_app' AND table_name='tenants' AND privilege_type='UPDATE'
ORDER BY column_name;
```

### Teste negativo (é o que fecha o gap)

Sem ele, um bump futuro de schema ou uma migration descuidada reintroduz o grant
amplo sem ninguém perceber — e o GAP-02 volta silencioso. O teste deve, **na role
`conecta_app`**:

1. `UPDATE tenants SET status='suspended'` → espera **42501**. Idem para `slug`,
   `plan`, `retention_months`, `name`, `id`, `created_at`.
2. `updateTenantAppearance(tx, id, { homeBannerKey, logoUrl, accentColor })` →
   **passa** (é o caminho real, com `updated_at` injetado pelo Prisma).

`tests/integration/tenant-appearance.test.ts:38-70` já cobre o item 2 e já roda
sob `conecta_app` (via `withTenant`) — basta somar o item 1 no mesmo arquivo.

**Cuidado ao escrever o teste:** cada tentativa negada aborta a transação, e as
seguintes devolvem `25P02` (*in_failed_sql_transaction*) em vez do `42501` real —
foi o que aconteceu no meu primeiro ensaio e invalidou 4 dos 5 resultados. Use
`SAVEPOINT` / `ROLLBACK TO SAVEPOINT` por tentativa, ou um `it()` por coluna.

---

## O que está sólido (registrado para não ser reauditado à toa)

- Isolamento multi-tenant das entidades novas: RLS FORCE + policy com `WITH CHECK`
  em `benefits` e `post_media`, confirmado no banco, com teste dos dois lados.
- Resolução de tenant por path: Edge é transporte, Node é autoridade, RLS é
  backstop. O desenho aguenta até um bypass de middleware (ver 6.3).
- Autorização: 100% das rotas e actions `/admin` com `requireAdmin`, em duas
  camadas (layout + action). Nenhum endpoint aceita `tenant_id` do cliente.
- Namespace de storage por tenant, com autorização por prefixo testada
  (`authorize.test.ts`).
- Sniff de magic number no anexo e no branding: o tipo gravado vem do conteúdo
  real, nunca do declarado. Objeto reprovado é apagado.
- Triggers de imutabilidade intactos; GRANTs sem `ALL`; `conecta_app` sem
  superuser nem `bypassrls`, com boot check.
- Migrations sem drift real (só o ruído documentado do `search_vector`).
- Headers de segurança (`nosniff`, CSP, HSTS, `frame-ancestors 'none'`) em todas
  as rotas.
- Design-system: laranja só em ação/pendência; nenhum uso decorativo novo.
- 266 testes verdes, lint e typecheck limpos, sem flakiness reproduzível.
