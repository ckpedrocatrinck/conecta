# INC-019 — Banner por seção (Vagas, Benefícios)

**Status:** ✅ Concluído
**Fase:** pré-piloto (paridade com a tela "Aparência da empresa")
**Depende de:** INC-017 (Aparência da empresa) FECHADO — reusa a mesma
abstração de upload (MediaStorage + presigned + confirm com magic number) e a
mesma tela de admin.

## Contexto (fatos do levantamento read-only anterior)
- A tela "Aparência" (INC-017) só edita o banner da HOME (`Tenant.homeBannerKey`).
- Vagas usa asset estático próprio (`public/banners/vagas.png`), com o caminho
  como string literal hardcoded em 2 arquivos (`vagas/page.tsx`,
  `admin/vagas/page.tsx`) — **não é** o `homeBanner` vazando, é uma arte fixa
  própria, sem UI para trocar.
- Benefícios estava inconsistente: `admin/beneficios/page.tsx` mostrava a arte
  FIXA da home (`/banners/home.png`) hardcoded — não a `homeBannerKey`
  configurada do tenant —, enquanto `beneficios/page.tsx` (colaborador) não
  passava `imageSrc` nenhum, caindo no bloco de texto do `HomeBanner`.
- Não existia nenhum conceito de "seção" no schema — tudo era um valor único
  por Tenant.

## Decisão de arquitetura (fechada antes da implementação, não reaberta)
**Colunas fixas em `tenants`** (`vagasBannerKey`, `beneficiosBannerKey`), mesma
natureza de `homeBannerKey`. Rejeitada a alternativa de tabela `Banner`/CRUD:
`tenants` não tem RLS e o `GRANT UPDATE ON tenants` já concedido no INC-017
cobre as colunas novas — zero GRANT/policy nova. Tabela nova exigiria GRANT +
RLS + entrada no `EXPECTED` de `grants-matrix.test.ts` para nenhum ganho real
neste escopo (2 seções fixas, sem CRUD, sem agendamento).

## Escopo
1. **Modelo de dados:** `Tenant.vagasBannerKey` e `Tenant.beneficiosBannerKey`
   (`String?`, nullable), key do MediaStorage (`branding/{tenantId}/{vagas-banner
   |beneficios-banner}/{uuid}`), mesmo padrão de `homeBannerKey`.
2. **Namespace de storage:** extensão aditiva do regex de `authorizeMediaKey`
   — de `{banner|logo}` para `{banner|logo|vagas-banner|beneficios-banner}`.
   Nenhuma key existente muda de forma; `"banner"` continua sendo só a home.
3. **Tela de Aparência:** 2 cards novos ("Banner de Vagas", "Banner de
   Benefícios"), mesmo componente `AppearanceUploader` e mesmo fluxo de
   upload/confirm/auditoria do banner da home e do logo.
4. **Resolução nas telas:**
   - Vagas (colaborador + admin): lê `vagasBannerKey`; sem key, cai no asset
     fixo já existente (`/banners/vagas.png`) — Vagas continua com arte
     garantida mesmo sem configuração.
   - Benefícios (colaborador + admin): lê `beneficiosBannerKey`; sem key, cai
     no **modo texto** do `HomeBanner` (sem imagem nenhuma) — não há asset fixo
     próprio de Benefícios, decisão de escopo. Isso corrige a inconsistência:
     antes o admin mostrava a arte da home hardcoded, o colaborador mostrava
     texto; agora as duas telas se comportam igual.

## Fora de escopo
- Tabela `Banner`/CRUD, agendamento, múltiplos banners por seção, links
  (a "Opção D" já descartada no INC-017).
- Ativação do R2 (banner de seção é imagem — depende de R2 em produção, igual
  banner/logo do INC-017; segue o mock local em dev).
- Contraste AA da cor de destaque (registrado como DP-22, não implementado).
- `public/banners/beneficios.png` — não existe e não foi criado (é decisão de
  design, não pendência técnica).

## Critérios de aceite
- [x] Migration adiciona `vagas_banner_key`/`beneficios_banner_key`;
      `migrate deploy` aplica limpo.
- [x] `grants-matrix.test.ts` verde sem alterar `EXPECTED` — `UPDATE ON tenants`
      do INC-017 cobre as colunas novas.
- [x] Key antiga `branding/{t}/banner/{uuid}` continua autorizada após a
      extensão do regex (teste de regressão em `authorize.test.ts`).
- [x] Aparência sobe banner de Vagas e de Benefícios (upload → confirm →
      coluna gravada), sob `requireAdmin`, com auditoria
      (`tenant.appearance.update`).
- [x] Vagas mostra o banner do tenant quando configurado; senão
      `/banners/vagas.png`.
- [x] Benefícios (admin E colaborador) mostram o mesmo: banner do tenant se
      configurado, senão modo texto — as duas telas combinam.
- [x] Testes de resolução por seção passam (`section-banner-display.test.ts`).
- [x] Trocar o banner de um target apaga SÓ o objeto anterior daquele target —
      os outros 3 (home, logo, o outro banner de seção) continuam intactos
      (`appearance-section-banner-actions.test.ts`).
- [x] Doc INC-019 escrito; DP-15 marcada resolvida; `modelo-de-dados.md`
      atualizado; DP-22 (contraste AA) registrada.
- [x] `npm run lint && npm run typecheck && npm run test` verdes.

## Registro de conclusão
- **Concluído em:** 2026-07-30
- **Branch:** inc-019-banner-por-secao
- **Migração (ADR-008, `prisma migrate deploy`):**
  `20260730184007_inc019_tenant_section_banner_keys` (colunas
  `vagas_banner_key`, `beneficios_banner_key`) — sem GRANT/RLS novo (`tenants`
  não tem RLS; `UPDATE` já concedido no INC-017 cobre).
- **Testes:** suíte verde (novos/estendidos: `authorize.test.ts` — view/upload/
  isolamento dos 2 targets novos + regressão da key antiga de `banner`;
  `section-banner-display.test.ts` — resolução key→src das 2 seções;
  `tenant-appearance.test.ts` — escrita das 2 colunas novas sob `conecta_app`;
  `appearance-section-banner-actions.test.ts`, novo — `confirmBrandingUploadAction`
  ponta a ponta para os 2 targets novos, incluindo a prova de que trocar um
  target apaga só o objeto daquele target, não dos outros 3).

---

## Relatório de Entrega — INC-019
**Data:** 2026-07-30
**Branch:** inc-019-banner-por-secao

### O que foi implementado
- **Modelo:** `Tenant.vagasBannerKey`/`beneficiosBannerKey` (nullable),
  migration à mão (ADR-008, `prisma migrate deploy`).
- **Namespace de storage:** `authorize.ts` — regex de `branding/` estendido
  para aceitar `vagas-banner`/`beneficios-banner`, mesma regra de tenant/role
  dos targets existentes (view: qualquer sessão do tenant; upload: só admin).
- **Repositório:** `findTenantVagasBannerKey`/`findTenantBeneficiosBannerKey`
  (mesmo padrão de `findTenantHomeBannerKey`); `TenantAppearanceUpdate`
  estendido com os 2 campos novos.
- **`section-banner-display.ts` (novo):** `resolveVagasBannerSrc` (fallback
  `/banners/vagas.png`) e `resolveBeneficiosBannerSrc` (fallback `undefined` —
  modo texto), usados pelas 4 telas (Vagas/Benefícios × colaborador/admin).
- **`actions.ts`:** `BrandingTarget` estendido para 4 valores;
  `confirmBrandingUploadAction` passou de um ternário `banner`/resto para um
  mapa de 4 entradas (`FIELD_BY_TARGET`, `PREVIOUS_KEY_BY_TARGET`) — cada
  target só mexe na sua própria entrada, o resto do fluxo (guard de prefixo,
  `validateUploadedObject`, rejeição de não-imagem, `withTenant` +
  `updateTenantAppearance` + `recordAuditLog`, remoção do objeto antigo)
  ficou idêntico ao do INC-017.
- **Telas:** Vagas (colaborador + admin) e Benefícios (colaborador + admin)
  passaram a resolver a key do tenant em vez de string literal/hardcode.
  Benefícios admin deixou de mostrar a arte da home — agora se comporta igual
  ao colaborador (banner do tenant ou texto).
- **Aparência:** 2 cards novos ("Banner de Vagas", "Banner de Benefícios"),
  mesmo componente de upload; `emptyLabel` novo no `AppearanceUploader` para o
  card de Benefícios dizer corretamente "a tela mostra só o texto" (não "arte
  padrão", que não existe para essa seção).

### Decisões tomadas durante a implementação
- **Mapa de 4 entradas em vez de ternário aninhado** em `confirmBrandingUploadAction`
  — ficou explícito que cada target lê/grava seu próprio campo, o que também
  tornou óbvio (e testável) que trocar um banner não pode afetar os outros 3.
- **Preview do admin usa a key crua (ou nada), nunca o fallback de outra
  seção:** a tela de Aparência mostra "sem imagem" quando não há key — usar o
  fallback ali (ex.: mostrar `/banners/vagas.png` como se fosse a configuração
  do tenant) confundiria o admin sobre o que está de fato salvo. A resolução
  com fallback (`resolveVagasBannerSrc`/`resolveBeneficiosBannerSrc`) é só para
  as telas públicas.

### Como testar (QA manual local — URL com slug)
Pré: `npm run dev`, Docker/Postgres no ar, logado como admin.
1. **Vagas:** `/{slug}/admin/aparencia` → subir um banner em "Banner de Vagas" →
   "Banner de Vagas atualizado." → abrir `/{slug}/vagas` (colaborador) e
   `/{slug}/admin/vagas` → o banner novo aparece nas duas.
2. **Benefícios:** subir um banner em "Banner de Benefícios" → abrir
   `/{slug}/beneficios` (colaborador) e `/{slug}/admin/beneficios` → o banner
   novo aparece nas duas.
3. **Fallback de Vagas:** tenant sem `vagasBannerKey` (ex. tenant novo de seed)
   → `/vagas` e `/admin/vagas` mostram a arte fixa `/banners/vagas.png`.
4. **Fallback de Benefícios:** tenant sem `beneficiosBannerKey` → `/beneficios`
   e `/admin/beneficios` mostram o bloco de texto verde (sem imagem) — as duas
   telas iguais (antes o admin mostrava a arte da home; agora não mostra mais).
5. **Isolamento:** key `branding/{tenantA}/vagas-banner/...` não acessível por
   sessão de outro tenant — coberto por teste.
6. **Troca não cruza campos:** subir banner de Vagas duas vezes seguidas — o
   logo, o banner da home e o banner de Benefícios continuam intactos —
   coberto por teste (`appearance-section-banner-actions.test.ts`).

### Pendências / dívidas técnicas
- Banner de Vagas e de Benefícios (imagens) dependem do R2 em PRODUÇÃO, igual
  banner/logo do INC-017 — mock local funciona em dev. Já registrado no
  roadmap e no INC-013 ("Dependências externas").
- DP-22 registrada (nova, não implementada): cor de destaque valida só o
  formato hex, não o contraste AA que a própria DP-15 pedia.
- Mesma flakiness pré-existente de contenção paralela na infra de testes
  (`immutability-triggers.test.ts`, TRUNCATE sob concorrência) observada
  durante a rodada — alheia a este INC, runs isolados/repetidos passam.
