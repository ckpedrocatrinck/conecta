# INC-017 — Aparência da empresa (banner da home + logo + cor)

**Status:** ✅ Concluído
**Fase:** feature pré-piloto (banner editável, decisão de Pedro)
**Depende de:** INC-016 (anexos) FECHADO — reusa a abstração de upload
(MediaStorage + presigned + validação por magic number). NÃO fazer em paralelo
ao 016 (ambos tocam a abstração de storage).
**Resolve também:** DP-15 (tela de admin para logo/cor do tenant, antes adiada).

## Contexto (fatos do levantamento)
- Existe UM componente de banner de conteúdo (`HomeBanner`), reusado em 6 telas,
  100% estático: texto EMBUTIDO nos PNGs (`public/banners/home.png`,
  `vagas.png`), zero vem do banco.
- Como o texto está DENTRO da imagem, não há "editar só texto" — editar o banner
  = trocar a imagem. Logo, depende do storage/R2.
- O `Tenant` já tem `logoUrl` + `accentColor` sem UI de edição (DP-15, "piloto
  configura no banco"). Mesma natureza do banner → agrupar numa tela só.

## Escopo (Opção B + DP-15, contido)
Uma tela de admin **"Aparência da empresa"** com TRÊS campos:
1. **Banner da home** (imagem, por-tenant) — upload via storage. Substitui o
   `public/banners/home.png` fixo por uma imagem do tenant, lida do banco.
2. **Logo** (imagem, por-tenant) — resolve o `Tenant.logoUrl` (DP-15).
3. **Cor de destaque** (`Tenant.accentColor`) — seletor de cor, valor no banco.
   **NÃO depende de R2** (é texto) — funciona no piloto mesmo sem R2 ativo.

**Contido de propósito:** três campos numa tela. NÃO é editor de tema, NÃO é
personalização profunda, NÃO é banner por seção (só o da home). Vagas/benefícios
seguem com arte fixa por ora (fora de escopo).

## Dependência do R2 (explícita)
- Banner e logo (imagens) dependem do R2 em PRODUÇÃO. Dev local usa o mock
  (`LocalMediaStorage` + `/api/media`), funciona sem R2.
- Cor de destaque NÃO depende de R2 — pode ir ao piloto independente.
- Este INC ENGROSSA a lista de features dependentes de R2 (INC-016 anexos,
  logos de benefício fase 2, e agora banner+logo). O R2 é o item mais crítico do
  deploy: se falhar, banner/logo/anexos caem juntos. Registrar na checklist de
  go-live.

## Modelo de dados
- `Tenant.homeBannerKey` (String?, nullable) — chave do objeto de storage do
  banner. Nulo = usa o fallback fixo atual (`public/banners/home.png`).
- `Tenant.logoUrl` já existe — passa a ser gravável pela tela (hoje só no banco).
  (Confirmar se logoUrl vira key de storage ou continua asset público — decidir
  no plano; idealmente unificar com o storage.)
- `Tenant.accentColor` já existe — passa a ser gravável pela tela.
- Migration manual (ADR-008) só para `homeBannerKey`.

## Comportamento
- `HomeBanner` da home: se `tenant.homeBannerKey` existe → serve via `/api/media`
  (token). Senão → fallback para o `public/banners/home.png` atual (nunca fica
  sem banner). Fallback é importante: tenant novo sem banner configurado não pode
  ter tela quebrada.
- Upload reusa o fluxo do INC-016 (presigned + validação magic number + limites).
  Banner é imagem (jpg/png/webp), limite de imagem (5 MB).

## Telas
- Admin: nova tela "Aparência da empresa" (`/{slug}/admin/aparencia` ou dentro de
  configurações). `requireAdmin`. Upload de banner, upload de logo, seletor de
  cor. Preview do banner atual. Feedback + confirmação (padrão INC-012.5).
- Colaborador: nenhuma tela nova — só passa a ver o banner do tenant (ou o
  fallback).

## Fora de escopo
- Banner por seção (vagas, benefícios) — segue arte fixa.
- Editor de tema / personalização profunda.
- Agendamento/campanhas de banner (Opção D).
- Texto de banner separado da imagem (o texto está no PNG; quem quiser texto novo
  troca a imagem).

## Critérios de aceite
- [x] Admin sobe banner da home → colaborador vê o novo banner na home (leitura
      de `tenant.homeBannerKey` na home do colaborador e do admin).
- [x] Admin sobe logo → aparece nos cards gerados (assinado no browser) e no PNG
      exportável (data URI).
- [x] Admin ajusta cor de destaque → reflete nos cards (sem depender de R2).
- [x] Tenant SEM banner configurado → fallback para `public/banners/home.png`
      (home nunca quebra).
- [x] Upload reusa validação do INC-016 (magic number, limite 5 MB); rejeita
      inválido/disfarçado + só imagem (rejeita PDF).
- [x] Isolamento: banner/logo de um tenant não acessível por outro —
      `authorize.test.ts` (view e upload negados cross-tenant).
- [x] Sem R2 em dev (mock local); R2 registrado como pré-req de produção
      (roadmap + INC-013 "Dependências externas").
- [x] lint+typecheck+test verdes; QA visual aprovado por Pedro.

## Registro de conclusão
- **Concluído em:** 2026-07-24
- **Branch:** inc-017-aparencia-da-empresa
- **Migrações (ADR-008, `prisma migrate deploy`):**
  `20260724164005_inc017_tenant_home_banner_key` (coluna `home_banner_key`) e
  `20260724170000_inc017_grant_update_tenants` (`GRANT UPDATE ON tenants TO
  conecta_app` — 1ª escrita da app em `tenants`).
- **Testes:** suíte verde (novos: isolamento do namespace `branding/` em
  `authorize.test.ts`; escrita em `tenants` sob `conecta_app` em
  `tenant-appearance.test.ts`; data URI do export + assinatura no browser em
  `branding-display.test.ts`).
- **QA validado por Pedro:** banner/logo/cor com feedback ao salvar; cor no ato;
  preview fiel ao recorte ao vivo; colaborador vê banner novo e logo nos cards;
  PNG baixado com logo embutido; fallback quando sem banner.

---

## Relatório de Entrega — INC-017
**Data:** 2026-07-24
**Branch:** inc-017-aparencia-da-empresa

### O que foi implementado (em 3 blocos + 1 fix + ajustes)
- **Bloco 1 — modelo/storage:** `Tenant.homeBannerKey` (nullable); `logoUrl`
  passou de asset público direto a **key de storage** (unificado com o banner).
  Namespace `branding/{tenantId}/{banner|logo}/{uuid}` em `/api/media`
  (`authorizeMediaKey`, extraída para módulo puro): view = qualquer sessão do
  mesmo tenant, upload = só admin, PUT só imagem. `updateTenantAppearance`
  (update parcial) + `findTenantHomeBannerKey`.
- **Bloco 2 — tela admin `/{slug}/admin/aparencia`** (`requireAdmin`): upload de
  banner + logo reusando o fluxo do INC-016 (presigned + confirm com magic
  number), seletor de cor, preview, feedback, auditoria
  (`tenant.appearance.update`). **Key com uuid por upload**: um envio inválido
  não sobrescreve o banner/logo atual — a troca de key + remoção do objeto
  antigo só ocorre no confirm aprovado.
- **Bloco 3 — leitura (colaborador):** `HomeBanner` (home do colaborador e do
  admin) lê `homeBannerKey` → assinada via `/api/media` ou **fallback**
  `public/banners/home.png`. Logo nos cards: `findTenantBranding` devolve a key
  crua; a camada de view **assina** (`signBrandingForDisplay`) nos server pages
  (mesma abordagem do `photoUrl`). No **PNG exportável** (satori, server-side sem
  cookie), o logo é embutido como **data URI** (`inlineBrandingLogoForExport`) —
  a URL assinada de `/api/media` não serve ali.
- **Fix (durante o QA):** salvar banner/logo/cor dava "erro de formato" mas a
  causa real era `42501 permission denied for table tenants` — `conecta_app` só
  tinha `SELECT` em `tenants` (INC-017 é a 1ª escrita da app nessa tabela).
  Migration de `GRANT UPDATE` (mínimo privilégio) + catch do uploader honesto
  (distingue 500 de rejeição de validação, não mascara mais).
- **Ajustes de UI:** feedback ao salvar (antes salvava em silêncio); cor salva
  no ato (sem botão); tamanho recomendado (1920×1080, 16:9, "mantenha o
  essencial centralizado"); preview do banner fiel ao recorte ao vivo
  (`object-cover` + teto 208px, não mais `object-contain`).

### Decisões tomadas durante a implementação
- **Logo unificado no storage** (não asset público): consistente com o R2.
  Consequência não-óbvia resolvida no plano — o logo no PNG exportável precisa de
  **data URI** porque o satori roda sem o cookie de sessão que a URL assinada
  exige. Sem isso, logo apareceria na tela mas quebrado no PNG baixado.
- **Repositório devolve a key crua; a view assina** (igual ao `photoUrl`): o
  export usa a key crua para o data URI, o browser assina — sem duplicar leitura.
- **`GRANT UPDATE` mínimo em `tenants`**: só UPDATE (a app altera tenant
  existente, nunca cria/apaga). `tenants` não tem RLS (raiz) — a autorização de
  "quem edita a aparência" é a camada de app (`requireAdmin` + tenant do
  contexto).
- **Banner com altura fixa (208px) + largura responsiva** ⇒ o aspecto da caixa
  varia por tela (1,58:1 mobile → 3,08:1 desktop colaborador → 4,77:1 admin);
  nenhuma proporção enche as três igual. 16:9 é o melhor equilíbrio (arte inteira
  no mobile, corte de topo/base no desktop) — daí o recado de **centralizar**.

### Como testar (QA local — URLs com slug `vale-verde`)
Pré: `npm run dev`, Docker/Postgres no ar, logado como admin.
1. **Cor (sem R2):** `/vale-verde/admin/aparencia` → escolher uma cor →
   salva no ato ("Cor atualizada.") → ver o acento nos cards do feed em
   `/vale-verde`.
2. **Banner:** subir um JPG/PNG/WEBP (idealmente 1920×1080) → "Banner
   atualizado."; o preview mostra o **recorte real**. Abrir `/vale-verde`
   como colaborador → banner novo no topo.
3. **Fallback:** tenant sem `homeBannerKey` → a home mostra a arte padrão
   (`/banners/home.png`), sem quebrar.
4. **Logo:** subir um logo → aparece nos cards do feed (topo). Baixar o card
   (PNG) de um reconhecimento → o **logo vem embutido** no PNG.
5. **Rejeição:** renomear um `.txt`/`.pdf` para `.png` e enviar → rejeição (só
   imagem, magic number); um PDF real também é recusado no banner/logo.
6. **Isolamento:** a key `branding/{tenantA}/...` não é acessível por sessão de
   outro tenant (403) — coberto por teste.

### Pendências / dívidas técnicas
- **R2 é pré-requisito de PRODUÇÃO** para banner e logo (imagens; mock local não
  sobrevive em serverless). **Cor de destaque NÃO depende de R2** (texto no
  banco) — funciona no piloto independente. Registrado no roadmap e na checklist
  de go-live do INC-013 ("Dependências externas").
- `npx prisma generate` deu `EPERM` (DLL do query engine travada pelo dev server
  no Windows) — os tipos regeneraram; só adicionou coluna (engine compatível).
  Reiniciar o dev server atualiza o binário. Não bloqueia.
- Flakiness de contenção paralela na infra de testes (`cleanup-tenant`), pré-
  existente e alheia a este INC — runs isolados e repetidos passam.
