# INC-016 — Anexos no feed (imagem + PDF)

**Status:** ✅ Concluído
**Fase:** 3 — Engajamento
**Depende de:** INC-003 (storage assinado + /api/media), INC-008 (feed/posts)

## Objetivo
Permitir anexar arquivos aos posts do feed: **imagem** (JPG/PNG/WEBP) para
prestigiar reconhecimentos/confraternizações, e **documento PDF** para casos que
exigem anexar um documento. Servido com a mesma segurança das fotos (sessão +
token, isolado por tenant — LGPD), gravado/lido pela abstração de storage.

## Escopo
1. Modelo: estende `PostMedia` (não cria tabela nova) com `kind` (image|document),
   `mime_type`, `original_name`, `size_bytes`. Até **5 anexos por post**, imagem e
   PDF misturados. Multi-tenant (tenant_id + RLS já existentes).
2. Upload **direto ao storage** via URL assinada (presigned) — obrigatório pelo
   limite de 4,5 MB de payload de função serverless da Vercel
   (`FUNCTION_PAYLOAD_TOO_LARGE`), que impediria PDF de até 10 MB de passar pelo
   código de função.
3. Validação de **tipo real por magic number** no **confirm** (não confia na
   extensão nem no content-type declarado): lê só o cabeçalho do objeto já
   gravado, detecta o tipo, confere o tamanho real e **apaga** o objeto se
   reprovar. Tipos aceitos: jpg/png/webp + pdf. Limites: imagem ≤ 5 MB, PDF ≤ 10 MB.
4. Visualização (mobile 360px): imagem inline (thumbnail, abre grande);
   PDF como **card de documento** (ícone + nome + tamanho + abrir), nunca inline.
5. Acesso só via `/api/media` (sessão + token + tenant) e `/api/anexo/[id]` (re-assina
   o link no clique). Nunca URL pública adivinhável.
6. **Auto-rascunho (solução TEMPORÁRIA — ver DP-19):** "Novo post" cria/reaproveita
   um rascunho e leva direto à tela de compor (que já tem a seção Anexos), para o
   admin anexar na mesma tela em que escreve — a chave do storage precisa do
   `postId`. Órfãos tratados 100% no DB (reusa 1 rascunho *pristine* por admin +
   apaga extras + não lista pristine + guard de publicação exige título). A solução
   limpa (staging por sessão) depende do R2 e fica como dívida (DP-19).
7. **Preview com a imagem + lightbox:** o "Preview do card" na tela de compor mostra
   as imagens anexadas (como no feed real); clicar em qualquer thumbnail (preview ou
   seção Anexos) abre a imagem ampliada num lightbox (sobreposição, componente
   reutilizável `ImageLightbox` sobre o Dialog do base-ui).

## Critérios de aceite
- [x] Upload aceita jpg/png/webp/pdf e **rejeita o resto**, inclusive arquivo com
      extensão falsa (executável renomeado para .pdf) — `media-sniff.test.ts`,
      `validate-upload.test.ts`.
- [x] Limite: imagem >5 MB e PDF >10 MB rejeitados (tamanho real no confirm);
      objeto reprovado é apagado do storage — `validate-upload.test.ts`.
- [x] Isolamento: anexo de um tenant não é acessível por outro (findPostMediaById
      cross-tenant → null → 404; RLS WITH CHECK no insert) —
      `post-attachments.test.ts` + `tenant-isolation.test.ts`.
- [x] Anexo servido só com sessão/token; nunca público — contrato reusado de
      `/api/media` + `media-storage.test.ts`.
- [x] Feed em 360px: PDF como card de documento empilhado, sem scroll horizontal.
- [x] Auto-rascunho: "Novo post" cai direto na tela de compor com Anexos; ≤1
      rascunho pristine por admin (reuso + limpeza); pristine não aparece na lista;
      não publica sem título — `post-auto-draft.test.ts`.

## ⚠️ Pré-requisito de PRODUÇÃO — ativar o R2 ANTES de subir
Em **dev**, o storage é o **mock local** (`.local-media`, fora de `public/`,
servido só via `/api/media`). Isso **não sobrevive em produção serverless**: o
disco é efêmero e por instância — anexos gravados sumiriam. Antes do go-live:

1. Implementar `R2MediaStorage` sobre a interface `MediaStorage` (já preparada):
   - `getUploadUrl` → presigned PUT **com `content-length-range`** (cap de tamanho
     na borda; o confirm continua sendo o backstop de tamanho/tipo).
   - `getViewUrl` → presigned GET.
   - `readHead(key, n)` → GetObject com `Range: bytes=0-(n-1)` (o `Content-Range`
     entrega o tamanho total).
   - `delete(key)` → DeleteObject.
2. **Testar o fluxo real** (upload direto ao bucket + confirm + view) ANTES de
   liberar a feature.
3. Virar a chave: trocar `mediaStorage` de `LocalMediaStorage` para `R2MediaStorage`
   em `src/lib/storage/media-storage.ts`. Nenhum chamador muda (dependem só da
   interface).

## Follow-ups ligados à ativação do R2
- **Orphan-sweep** (fora deste INC): um upload válido cujo confirm nunca rodou
  (aba fechada, rede caiu) fica no storage **sem linha em `PostMedia`** — invisível
  no produto (banco é a fonte de verdade), mas ocupa espaço no bucket. Quando o R2
  entrar, adicionar `list()` à interface e uma rotina que apaga objetos sob o
  prefixo de post sem `PostMedia` correspondente e mais velhos que ~24h. Em dev o
  risco é nulo (disco descartável).
- **`delete(key)` na anonimização** (follow-up do INC-013 G1, ver comentário em
  `media-storage.ts`): agora que `delete` existe na interface, a anonimização de
  desligados deve apagar também os objetos físicos (avatar + anexos), não só anular
  as referências no banco.

## Registro de conclusão
- **Concluído em:** 2026-07-24
- **Branch:** inc-016-anexos-no-feed
- **Migração:** `20260724100000_inc016_post_media_attachments` (aplicada com
  `prisma migrate deploy`, ADR-008).
- **Testes:** suíte verde (novos: sniff, validação de confirm incl. arquivo
  disfarçado ponta-a-ponta no storage real, contrato de storage local, isolamento
  de anexo, auto-rascunho).

---

## Relatório de Entrega — INC-016
**Data:** 2026-07-24
**Branch:** inc-016-anexos-no-feed

### O que foi implementado
- Modelo: `PostMedia` estendido (`kind`, `mime_type`, `original_name`,
  `size_bytes`) + enum `PostMediaKind`. Migração à mão (ADR-008), backfill
  `kind='image'` para linhas legadas; sem tocar policy/grant de RLS.
- Storage: interface `MediaStorage` ganhou `readHead(key, maxBytes)` e
  `delete(key)`; `LocalMediaStorage` implementa sobre `.local-media`
  (`readMediaHead`, `deleteMediaFile`).
- Upload presigned + validação no confirm: `requestPostAttachmentUploadUrl` (gera
  a URL de envio) e `confirmPostAttachmentUploadAction` (lê o cabeçalho, faz o
  sniff do magic number, confere o tamanho real, apaga o objeto se reprovar, e só
  então grava `PostMedia`). Núcleo isolado e testável em
  `src/lib/storage/validate-upload.ts` e `media-sniff.ts`.
- Feed: imagens inline (thumbnail que abre grande) + `DocumentAttachmentCard`
  para PDF. Rota `/api/anexo/[mediaId]` re-assina a view URL no clique (302).
- Admin: seção "Anexos" aceita imagem OU PDF (até 5), com validação antecipada no
  cliente e remoção que também apaga o objeto no storage.
- Avatar: como não tem etapa de confirm, a rota `/api/media` passou a validar
  o tipo por namespace (avatar → só imagem; posts → imagem+PDF).
- **Auto-rascunho (DP-19):** "Novo post" (`createOrReuseDraftAction`) cria/reaproveita
  um rascunho e leva direto à tela de compor (a antiga tela `novo/` foi removida —
  a de edição virou a única de composição). Órfãos tratados no DB:
  `findPristineDraftsByAdmin` + `deletePostsByIds` (reusa 1, apaga extras → ≤1 por
  admin), `findPostsForAdminList` exclui pristine, `publishPostAction` exige título.

### Decisões tomadas durante a implementação
- **Caminho presigned + validar-no-confirm** (em vez de proxy pelo servidor): o
  limite de 4,5 MB da Vercel impede PDF de 10 MB de passar pela função. A validação
  de tipo real não some — muda de lugar (lê só o cabeçalho do objeto já gravado).
  Decisão do Pedro com base em fato verificado; candidata a ADR se virarmos padrão
  para outros uploads grandes.
- **Estender `PostMedia`** em vez de tabela nova: reusa a pipeline de render do
  feed e a RLS existentes; regressão zero para as fotos do INC-008.
- **Interface ganhou `readHead` + `delete`**: evolução já prevista da abstração
  (o comentário de `media-storage.ts` antecipava estender no INC do R2). `delete`
  também habilita a limpeza do objeto na remoção de anexo e o follow-up de
  anonimização.
- **`kind`/`mime` vêm do sniff, nunca do cliente.**
- **Auto-rascunho é temporário (DP-19):** solução limpa (staging por sessão)
  depende do R2 (mover objetos no storage). O tratamento de órfãos escolhido
  (reuso + limpeza + não-listar + guard) limita o custo a ≤1 rascunho vazio por
  admin, sem sweep agendado.

### Como testar (QA local — URLs com slug `vale-verde`)
Pré: `npm run dev`, logado como admin do tenant de dev.
1. **Postar com imagem:** `/vale-verde/admin/posts` → **Novo post** → cai
   direto na tela de compor (`/vale-verde/admin/posts/{id}`) com a seção
   **Anexos** → enviar um JPG/PNG → preencher título/data → publicar. Ver no feed
   `/vale-verde` o thumbnail; tocar abre em tamanho grande.
2. **Postar com PDF:** mesmo fluxo, enviar um PDF (≤10 MB). No feed, aparece o
   **card de documento** (ícone + nome + tamanho + "Abrir"); tocar abre o PDF.
3. **Rejeição de tipo falso:** renomear um `.exe`/`.zip`/`.txt` para `documento.pdf`
   e tentar enviar → rejeição clara ("Tipo de arquivo não permitido…"); o objeto
   não vira anexo (e é apagado do storage).
4. **Limite:** enviar imagem >5 MB ou PDF >10 MB → rejeição de tamanho.
5. **360px:** abrir o feed em viewport 360px → sem scroll horizontal; PDFs
   empilhados.
6. **Auto-rascunho:** clicar **Novo post** 3× sem preencher → volta sempre ao mesmo
   rascunho vazio; a lista de posts **não** mostra rascunhos vazios; tentar publicar
   sem título → erro "Preencha ao menos o título antes de publicar."
7. **Preview + lightbox:** anexar uma imagem → ela aparece no "Preview do card";
   clicar na imagem (no preview ou na seção Anexos) → abre ampliada; clicar fora / no
   × → fecha.

### Critérios de aceite
- [x] Tipos válidos aceitos, inválidos (incl. extensão falsa .exe/.zip/.txt→.pdf)
      rejeitados + objeto apagado — `media-sniff.test.ts`, `validate-upload.test.ts`,
      `local-media-fs.test.ts` (ponta-a-ponta no storage real).
- [x] Limites 5/10 MB no tamanho real; objeto reprovado apagado — testes.
- [x] Isolamento por tenant; nunca público — testes + contrato /api/media.
- [x] Feed 360px com card de PDF.
- [x] Auto-rascunho: compor+anexar na mesma tela; ≤1 pristine/admin; não lista
      pristine; não publica sem título — `post-auto-draft.test.ts`.

### Pendências / dívidas técnicas criadas
- **R2 é pré-requisito de produção** (ver seção acima) — mock local não sobrevive
  em serverless.
- **DP-19 — auto-rascunho é temporário**: solução limpa (staging por sessão)
  depende do R2. Registrada em `docs/05-Decisoes-Pendentes.md`.
- **Orphan-sweep** e **`delete(key)` na anonimização** — follow-ups ligados à
  ativação do R2 (mesmo conjunto de dívidas da DP-19).
- `npx prisma generate` deu `EPERM` ao renomear o `query_engine-*.dll.node`
  (arquivo travado por processo Node no Windows); os tipos foram gerados e os
  testes passam com o engine existente. Se der problema, fechar processos Node e
  rodar `npx prisma generate` de novo.
