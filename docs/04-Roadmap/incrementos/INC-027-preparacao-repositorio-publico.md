# INC-027 — Preparação e publicação do repositório

**Status:** 🔄 Em andamento — Blocos 0 a 4 concluídos (auditoria, backup/rotação, reescrita de
histórico, seed de demonstração, correções de produto, vitrine); Blocos 5 (travas) e 6
(publicação) pendentes. Repositório permanece **privado** até o Bloco 6.
**Fase:** Fora de fase (higiene de repositório / infraestrutura de portfólio)
**Depende de:** ADR-012 aceito
**ADRs relevantes:** 012, 010 (slug na URL), 011 (infra)
**Docs:** `auditoria-2026-07.md`, `03-LGPD/lgpd-requisitos-tecnicos.md`, `00-Processo/convencoes-git.md`

## Objetivo

Publicar o repositório do Conecta sem nenhum vínculo a empresa real (em conteúdo,
histórico, mensagem de commit, nome de arquivo, imagem ou log de CI), sem segredo e sem
dado pessoal de terceiro, com seed de demonstração povoado e vitrine legível — mantendo o
repositório como local de trabalho ativo do produto.

## Regra de execução

**Tornar o repositório público é o último passo e depende de autorização explícita do
Pedro.** Nenhum bloco de 0 a 5 altera a visibilidade do repositório. O Bloco 6 é
irreversível: só começa quando todos os critérios de aceite dos blocos anteriores estiverem
verificados **e** houver autorização registrada. Não há prazo — se qualquer critério ficar
em aberto, o INC permanece aberto e o repositório permanece privado por tempo
indeterminado. Não existe publicação parcial ou provisória.

## Escopo

Seis blocos com gate manual entre cada um. Nenhum bloco começa antes do anterior estar
verificado.

### Bloco 0 — Auditoria read-only

Não altera, cria, remove nem commita nada. Produz relatório com severidade 🔴🟠🟡🔵,
`arquivo:linha` ou SHA, e veredito explícito BLOQUEIA / NÃO BLOQUEIA.

- **D1 — Segredos no histórico completo.** A auditoria anterior cobriu apenas até
  `inc-012-pwa-push@614effd`; os INCs 013–026 nunca foram varridos. `gitleaks detect
  --source . --log-opts="--all"`; `.env*` já adicionado em qualquer commit; buscar chave
  privada VAPID, `CPF_HASH_PEPPER`, `CRON_SECRET`, `APP_DB_PASSWORD`, `POSTGRES_PASSWORD`,
  credenciais MinIO.
- **D2 — Dado pessoal real de terceiro (define o veredito).** Onde o `LocalMediaStorage`
  grava em disco e se esse caminho está ignorado; imagens e CSV/XLSX adicionados em
  qualquer commit; os 40 maiores blobs do histórico; qualquer captura de tela de sistema
  de terceiro em `docs/` ou `public/`.
- **D3 — Vínculo com empresa real.** Inventário completo dos termos do Apêndice A, com
  listas **separadas** para HEAD e para histórico, incluindo mensagens de commit e nomes
  de arquivo. Avaliar se `auditoria-usabilidade-2026-07.md` identifica o fornecedor mesmo
  sem o nome.
- **D4 — Infra exposta.** IP/host/domínio de VPS, URLs de túnel cloudflared, portas
  internas, credenciais em `.yml` versionado.
- **D5 — Documentação enganosa.** `docs/README.md` declara "Status geral: 📐 Fase de
  especificação (nenhuma linha de código escrita)" — seria a primeira frase lida num repo
  com 26 INCs entregues. Listar todo doc cujo status divirja do estado real; INCs sem
  Relatório de Entrega; roadmap desatualizado.

**Gate:** relatório revisado pelo Pedro. Achado 🔴 ou PII de terceiro suspende o INC até
replanejamento.

#### Bloco 0b — Addendum (lacunas reveladas pela execução do Bloco 0)

1. **`gitleaks` executado de fato.** A primeira passada foi manual porque a ferramenta não
   estava instalada. D1 não fecha em varredura manual.
2. **D3b — identificadores derivados.** A lista de termos original foi montada a partir de
   *nomes de empresa* e por isso não capturou um domínio de e-mail real do piloto em
   `.env.example` (`VAPID_SUBJECT`). Segunda passada específica para: domínio de e-mail,
   CNPJ, telefone, endereço de filial, nome de bairro real, padrão de matrícula, site e
   perfis sociais do cliente, nome do ERP legado.
3. **Inventário completo de refs.** `git branch -a`, `git tag`, `git stash list`,
   `git for-each-ref`. O `filter-repo --all` processa todas as refs alcançáveis — uma
   branch local esquecida ou um stash reintroduz tudo depois da reescrita.
4. **Decisão registrada:** o relatório forense do Bloco 0 **não é versionado**. Um repo
   público contendo relatório detalhado sobre a remoção da identidade de um cliente é
   sinalização para o que se quer justamente não sinalizar. A versão forense fica fora do
   repositório; uma versão sanitizada — método, cobertura e resultado, sem detalhe de
   achado — pode ser versionada e é positiva para o portfólio.

### Bloco 1 — Backup e rotação de credenciais

1. `git bundle create ~/backups/conecta-original-$(date +%F).bundle --all` — cópia
   completa e verificável do repositório original, guardada **fora do GitHub**. Verificar
   com `git bundle verify`. **Executar antes de qualquer exclusão de branch**, para que o
   backup preserve o estado real.
2. **Excluir a branch `chore/seed-senha-padrao`** (`git branch -D`), nunca enviada ao
   remoto. O script que reseta a senha de todos os usuários do tenant para valor fixo via
   role owner, sem guarda, não deve existir em ref alguma — vale independentemente da
   publicação, porque contorna a role de runtime e a RLS que o ADR-003 sustenta. A decisão
   registrada em **DP-27** permanece no vault; o código não. Excluir antes do Bloco 2:
   `filter-repo --all` reescreveria e preservaria essa branch em vez de descartá-la.
3. Rotação de **todas** as credenciais, independentemente do resultado do Bloco 0 (custo
   baixo, certeza alta): par de chaves VAPID, `CPF_HASH_PEPPER`, `CRON_SECRET`, senha da
   role `conecta_app`, `POSTGRES_PASSWORD`, credenciais MinIO.
4. Consequência conhecida da troca de VAPID: todas as subscriptions de push existentes
   deixam de valer e os dispositivos precisam reinscrever. Sem impacto — não há usuário
   real ainda.
5. Consequência conhecida da troca de `CPF_HASH_PEPPER`: os `cpf_hash` existentes deixam
   de resolver. Sem impacto no banco de dev (recriado pelo seed do Bloco 3).
   **Entregável:** `docs/03-LGPD/rotacao-de-pepper.md`, escrito a partir da execução real
   desta rotação — passo a passo, impacto em base com dados reais (todo login por CPF
   quebra até o re-hash), por que não é reversível e como o re-hash seria feito se houvesse
   dados. É o procedimento de emergência que o ADR-006 exige e que nunca foi escrito; a
   rotação deste bloco é a oportunidade de documentá-lo sem risco.

### Bloco 2 — Reescrita de histórico

1. `git filter-repo --replace-text` com o expressions file do Apêndice B (conteúdo de
   arquivos) e `--replace-message` com o mesmo arquivo (mensagens de commit).
2. `--path-rename` para arquivos cujo **nome** contenha termo vinculante.
3. `--invert-paths --path` para remover binários que `--replace-text` não alcança. Alvos
   confirmados pela auditoria:
   - `docs/06-Design/redesenho-prints/*.png` — capturas com nome do tenant real, logotipo e
     slug visível na URL (path-based, ADR-010), além dos dez nomes de pessoa da questão P1.
     Saem **independentemente** da resposta de P1: mesmo com nomes fabricados, a marca e o
     slug reais estão renderizados na imagem. Substituídas por capturas novas do seed Vale
     Verde no Bloco 4.
   - `public/branding/logo.png` e `public/branding/favicon.png` — logotipo real do cliente,
     servido pela aplicação hoje. Exige ativo substituto (Bloco 3).
   - Qualquer CSV/XLSX de import real, se o Bloco 0b confirmar existência.
4. **Consertar referências órfãs.** Remover caminhos por `--invert-paths` deixa links e
   embeds quebrados em markdown do vault. Varrer o HEAD por referências aos caminhos
   removidos e corrigi-las no mesmo commit `docs:` do passo seguinte.
5. Script que lê `.git/filter-repo/commit-map` e reescreve todas as referências de SHA nos
   Relatórios de Entrega dos INCs, em um commit `docs:` final.

**Nota de método:** `--replace-text` atua sobre conteúdo de blob de texto. Não renomeia
caminhos, não altera binários e não altera mensagens de commit — cada um exige a flag
própria acima. Ignorar isso produz falso sucesso.

### Bloco 3 — Seed de demonstração (Rede Vale Verde)

Não é limpeza; é feature de portfólio e insumo futuro de onboarding/treinamento.

- Tenant **Rede Vale Verde**, slug `vale-verde`, 3 filiais com nomes genéricos (Centro,
  Zona Norte, Distrito Industrial).
- ~40 colaboradores mantendo os rótulos genéricos atuais (`Colaborador 0-1`), distribuídos
  entre os papéis (DP-38 resolvida em 2026-08-12); avatares sintéticos gerados
  (boring-avatars / DiceBear) — **zero foto de pessoa real**. O README da raiz declara
  explicitamente que se trata de seed sintético, para que o rótulo genérico leia como
  deliberado e não como dado faltando.
- ~15 comunicados verossímeis com categorias e criticidades variadas, incluindo
  agendados e arquivados.
- **Acks parciais**, de modo que o painel de pendências exiba percentual intermediário
  (~60–70%) em vez de 0% ou 100% — é a tela que demonstra o núcleo do produto.
- Feed povoado, vagas abertas com candidaturas, aniversários distribuídos ao longo do ano.
- **Ativos visuais substitutos** (pré-requisito da remoção do branding real no Bloco 2):
  wordmark simples de Rede Vale Verde e favicon correspondente, em `public/branding/`,
  seguindo a paleta da direção Balcão do `design-system.md`. Não precisa ser elaborado —
  precisa existir e ser coerente, porque aparece em toda captura de tela.
- Credenciais de demonstração documentadas no README da raiz.

### Bloco 4 — Vitrine

- **README da raiz:** problema → tese jurídica (trilha de auditoria com valor probatório)
  → arquitetura → o que é tecnicamente difícil aqui → como rodar em ≤5 comandos →
  credenciais de demo. Screenshots do seed Vale Verde.
- **`docs/README.md`:** status real, substituindo a declaração de "nenhuma linha de código
  escrita". Índice do vault com o mapa ADR/INC/DP.
- Roadmap e Relatórios de Entrega pendentes atualizados (achados D5).
- Diagrama do isolamento multi-tenant.

### Bloco 5 — Travas

- Hook de pre-commit com `gitleaks` (bloqueio real, coerente com
  `claude-code-boas-praticas.md`: o inegociável vira hook, não linha de `CLAUDE.md`).
- Valores de CI migrados para GitHub Secrets (achado A7-4 da auditoria de julho).
- Regra de revisão: nenhum commit que introduza nome de empresa real.

### Bloco 6 — Publicação

1. Criar repositório **novo** no GitHub, público, e fazer o push do histórico reescrito.
2. Reconfigurar o CI no repo novo e confirmar verde.
3. Deletar o repositório antigo — apenas após o bundle do Bloco 1 estar verificado e o
   novo repo estar funcional. Deletar remove também os logs de execução do Actions, que a
   reescrita de histórico não alcança.
4. Perfil do GitHub: repo fixado; link inserido no CV.

## Fora do escopo

- Demo online em VPS → **DP-37** (sem VPS contratado).
- MinIO em produção, consolidação de upload, anonimização de desligados → caminho crítico
  do piloto, não deste INC.
- Qualquer feature de produto.
- Reescrita do currículo (trabalho paralelo, fora do vault).

## Critérios de aceite

- [ ] `grep` dos termos do Apêndice A retorna zero em HEAD, **e** `git log -S "<termo>"
      --all` retorna zero para cada termo, **e** `git log --all --format=%B | grep -i` retorna
      zero (mensagens de commit), **e** nenhum nome de arquivo no histórico contém termo.
- [ ] `gitleaks detect --log-opts="--all"` limpo.
- [ ] Nenhuma imagem, CSV ou XLSX com dado pessoal real de terceiro em qualquer commit.
- [ ] Todo SHA citado em Relatório de Entrega resolve no repo novo (`git cat-file -e <sha>`
      para cada um).
- [ ] Em máquina limpa, seguindo **apenas** o README: `docker compose up -d && npm run
      db:seed && npm run dev` sobe o app povoado com Rede Vale Verde e permite login com as
      credenciais documentadas.
- [ ] Painel de pendências exibe percentual intermediário com o seed novo.
- [ ] `npm run lint && npm run typecheck && npm run build && npm run test` verdes no CI do
      repositório novo.
- [ ] Hook de pre-commit **testado de verdade**: um segredo plantado deliberadamente é
      bloqueado.
- [ ] `docs/README.md` não declara mais "nenhuma linha de código escrita".
- [ ] Bundle offline verificado (`git bundle verify`) antes de o repo antigo ser deletado.
- [ ] Repositório antigo deletado.
- [ ] Nenhum arquivo `LICENSE` presente.
- [ ] `docs/03-LGPD/rotacao-de-pepper.md` escrito a partir da rotação real do Bloco 1.
- [ ] Autorização explícita do Pedro registrada **antes** de o Bloco 6 começar.

## Riscos

- **Reescrita de histórico é destrutiva e não se desfaz** — mitigado pelo bundle do Bloco 1
  e pela verificação de SHAs antes do Bloco 6.
- **Falso-negativo de `grep`** — termos como "grão" são palavras comuns em português;
  revisar hits um a um em vez de confiar em contagem zero.
- **Falso sucesso do `filter-repo`** — sem `--replace-message`, `--path-rename` e
  `--invert-paths`, o nome sobrevive em mensagens, caminhos e binários.
- **Identificação por cruzamento** — o CV vincula o autor publicamente ao empregador e à
  cidade. Manter setor + localidade no repo reconstrói o vínculo sem citar o nome. Ver
  Apêndice A.

## Pendências criadas

- **DP-37** — Demo online pública em VPS com seed Vale Verde e reset diário por cron.
  Bloqueada até contratação de infra.
- ~~**DP-38** — Nomes de colaborador no seed.~~ **Resolvida (2026-08-12):** mantém os
  rótulos genéricos (`Colaborador 0-1`); o README declara o seed como sintético.

## Registro de conclusão

*(a preencher ao final — data, branch, commit de merge, decisões tomadas durante a
execução, desvios do plano)*

### Blocos 0–1 (auditoria, backup e rotação de credenciais)

Executados em sessões anteriores. Bundle completo do histórico original cifrado e
verificado fora do GitHub (`C:\backups\inc027\`); branch `chore/seed-senha-padrao` excluída
antes da reescrita (nunca enviada ao remoto); rotação de VAPID, `CPF_HASH_PEPPER`,
`CRON_SECRET`, senha da role `conecta_app` e `POSTGRES_PASSWORD` concluída via script que
nunca leu `.env` diretamente. `docs/02-Arquitetura/rotacao-pepper.md` escrito a partir da
execução real.

### Bloco 2 (reescrita de histórico) — 2026-08-13

`git-filter-repo` executado uma única vez: 241→237 commits (4 esvaziados e podados),
substituição de termos (`--replace-text`/`--replace-message`) e remoção de 16 caminhos
(`--invert-paths`) — capturas de tela do redesenho, HTML de referência de design, logo e
favicon reais do cliente, e três documentos de auditoria/insumo jurídico interno. Todas as
51 citações de SHA em Relatórios de Entrega corrigidas via `commit-map`; 9 referências
órfãs reescritas (frase reescrita, não só link apagado); dois bugs sistêmicos de
concordância de gênero encontrados e corrigidos ("Rede Vale Verde" feminino herdando artigo
masculino de "Armazém"; "portal legado" masculino herdando artigo feminino de "Endoweb"),
incluindo uma string de UI viva (`src/app/[slug]/(app)/admin/page.tsx`). As 10 verificações
finais (ausência de termo em HEAD/histórico/mensagens/paths/objetos soltos, SHAs resolvem,
`gitleaks` limpo, lint/typecheck/build/test verdes, branches `inc-025`/`inc-026`/`main`
sobreviventes) passaram todas.

**Desvio consciente registrado:** um resíduo do termo "Unigrão" (nome de um LMS de
terceiro, não vinculável ao cliente-piloto nem ao autor) permanece em texto de **um** commit
antigo do histórico (fora do HEAD, já corrigido). Decisão: não repetir o `filter-repo` só
por isso — uma segunda passada trocaria os 237 SHAs novamente, invalidando as 51 citações
recém-corrigidas, por um ganho marginal (termo de produto de terceiro, não identificador do
cliente). Efeito colateral do próprio `filter-repo` (remoção do `origin` ao reescrever)
ressuscitou como branches locais as ~20 branches já podadas na Parte A do Bloco 1 — listadas
no relatório interno, pendente de nova poda antes do Bloco 6.

Relatório completo (expressions file, os 10 critérios, tabela de correções): `C:\backups\inc027\bloco-2-inc027.md` (fora do repositório).

### Bloco 3 (seed de demonstração Rede Vale Verde) — 2026-08-13

**Branding (Passo 1):** o Pedro adicionou manualmente wordmark (`public/branding/logo.png`,
2172×724) e favicon (`public/branding/favicon.png`, 1254×1254) de Rede Vale Verde. Varredura
completa em `src/`/`app/` mostrou que **nenhum caminho estático de branding é lido pelo
código hoje**: o ícone do PWA (`app/icon.tsx`, `app/apple-icon.tsx`, `icon-192.png`,
`icon-512*.png`) é gerado por código via `renderAppIconNode()` (glifo "C" sobre
`BRAND_TOKENS.primary`, adapta-se a qualquer paleta sem asset); a marca no header
(`AdminHeaderNav`) é texto ("C" + "Conecta" + nome do tenant), não imagem; e o logotipo
por-tenant (`Tenant.logoUrl`) é dado de banco + media storage (upload real via
`/admin/aparencia`), não um arquivo em `public/`. `favicon.ico` servido hoje é o padrão do
Next.js (não vinculado ao cliente). Decisão: em vez de inventar uma nova forma de consumo
(fora de escopo — arquitetura), reaproveitei o mecanismo **já existente** e feito
exatamente para isso: o seed grava `logo.png` no media storage local
(`branding/{tenantId}/logo/{uuid}`, mesma convenção do upload real) e seta `Tenant.logoUrl`
— aparece em qualquer tela que já renderiza o logo do tenant (cards de feed/vagas/benefícios
exportados). `favicon.png` permanece sem consumidor (não há favicon por-tenant na
arquitetura atual, correto para um produto multi-tenant); substituí-lo exigiria
`sharp`/`png-to-ico` (dependência nova) — não fiz, fica de fora do escopo deste bloco.
DP-36 (`/icon` e `/apple-icon` caem no regex de slug do middleware) não foi tocado por este
bloco e continua se aplicando sem mudança.

**Auditoria do seed antigo (Passo 2):** nomes de filial já eram genéricos
(`Filial Centro/Norte/Sul/Leste/Oeste`) — nenhum topônimo real de Petrópolis encontrado.
Nenhum outro dado de lugar/pessoa/empresa real no seed. Vínculo gestor↔filial (DP-12) já
respeitado pela distribuição por índice (1 gestor por filial quando `branchCount` = nº de
gestores). Seed idempotente (checagem de tenant existente). **Gap encontrado:** nenhuma
guarda de `NODE_ENV` existia — adicionada em `prisma/seed.ts` e `prisma/seed-dev-tenant-b.ts`
(bloqueia se `NODE_ENV=production`).

**Reescrita (Passo 3):** `buildTenantFixtures()` (compartilhada com 27 arquivos de teste de
integração) recebeu só uma extensão aditiva e retrocompatível (`opts.branchNames`) — nenhum
teste existente foi tocado. Todo o conteúdo de demonstração vive em
`prisma/seed-demo-content.ts` (novo) e é orquestrado por `prisma/seed.ts` reescrito:
- Tenant Rede Vale Verde / slug `vale-verde`; 3 filiais **Centro, Zona Norte, Distrito
  Industrial**; 40 colaboradores (`Colaborador 0-N`, DP-38); avatares deixados como
  `photoUrl: null` deliberadamente — o app já tem avatar sintético determinístico embutido
  (inicial + cor por hash do nome, `src/lib/cards/avatar.ts`, é o padrão documentado no
  design-system §5), então gerar um segundo mecanismo (boring-avatars/DiceBear) duplicaria
  o que já existe sem necessidade.
- 15 comunicados (`prisma/seed-demo-content.ts`): categorias e criticidades variadas,
  incluindo 2 agendados (`scheduled`, publishAt futuro) e 2 arquivados. 5 são
  `requires_ack` publicados, com acks calibrados entre 60–70% (confirmado pela função real
  do painel, `listAnnouncementPendencySummaries`: 62–64% em todos os 5).
- Logo do tenant semeado via media storage (ver Passo 1).
- Credenciais de demonstração previsíveis impressas na saída do seed (1 usuário por papel;
  senha inicial igual para todos, troca obrigatória no 1º login — comportamento real do
  produto, não simplificado para a demo).

**Validação (Passo 4) — todas as 6 passaram:**
1. Seed rodado com sucesso (`npx prisma db seed` → `tsx prisma/seed.ts`).
2. `npm run dev` + verificação autenticada via sessão real (login por CPF+senha): manifest
   do tenant (`Conecta · Rede Vale Verde`), logo servido byte-a-byte idêntico ao arquivo
   semeado via `/api/media/[key]` autenticado, e os 5 comunicados `requires_ack` publicados
   confirmados em 62–64% pela função real do painel de pendências. (Sem navegador disponível
   neste ambiente — verificação funcional/autenticada substituiu captura de tela.)
3. `npm run lint && npm run typecheck && npm run build && npm run test` — todos verdes
   (327/327 testes, sem nenhum quebrado pelo novo seed).
4. Seed rodado duas vezes seguidas: segunda vez detectou o tenant existente e não duplicou
   nada.
5. `git grep` (fixed-string) dos 17 termos de `expressions.txt` no HEAD: zero ocorrências
   fora dos dois arquivos de branding novos (que contêm "Vale Verde" — esperado, é a marca
   nova).
6. `SELECT current_user, usesuper FROM pg_user` via `APP_DATABASE_URL`: `conecta_app`,
   `usesuper = false` — confirmado não-superuser após o seed.

Relatório completo: `C:\backups\inc027\bloco-3-inc027.md` (fora do repositório).

**Pendências para antes do Bloco 4/6:** repodar as ~20 branches ressuscitadas pelo Bloco 2;
decidir o resíduo histórico "Unigrão" (aceitar vs. segunda passada de `filter-repo`);
resolver o placeholder `[NOME DO PRODUTO]` em `docs/03-LGPD/guia-conformidade-lgpd.md`
(identificado em auditoria anterior, fora do escopo deste bloco); decidir o destino de
`public/branding/favicon.png` (hoje sem consumidor); commitar ou descartar as edições locais
pendentes de `.claude/settings.json`/`.env.example` (fora do escopo deste INC — não tocadas).

### Bloco 3.9 (ordenação e datas de publicação nos comunicados) — 2026-08-13

Dois defeitos encontrados pelo Pedro na revisão visual do seed do Bloco 3.

**Defeito 1 — ordenação.** Causa raiz: `markAnnouncementPublished()` nunca gravava
`publish_at` — só `scheduleAnnouncementPublication()` gravava (a data agendada). Todo
comunicado publicado **direto** (sem agendamento, o caminho mais comum) ficava com
`publish_at = null` para sempre, e as listas do colaborador/painel de pendências (que já
ordenavam por `publish_at`, código correto) colocavam esse `null` como o mais antigo
possível — daí "recém-publicado aparece no fim". A lista do admin
(`findAnnouncementsForAdminList`) tinha um segundo defeito independente: ordenava por
`created_at`, que diverge de `publish_at` sempre que um agendado publica depois de outro
criado antes (cenário coberto por teste).

Campo escolhido para todo estado: `publish_at` com fallback para `created_at` **só** para
rascunho (único status sem `publish_at`) — função única `announcementOrderingDate()`,
usada nas 3 listas (colaborador, admin, painel de pendências) para não haver 3 regras
divergentes de novo. `publishAnnouncement()` agora grava `publish_at`: `now` na publicação
imediata; preserva a data agendada quando ela já passou (sweep, ou "publicar agora" depois
do horário marcado); usa `now` também se "publicar agora" antecipa um agendamento ainda no
futuro (senão a lista ordenaria pelo agendamento obsoleto, não pelo instante real em que o
conteúdo ficou visível).

**Defeito 2 — data de publicação ausente.** Corrigido: exibida na tela de leitura do
colaborador (com hora, fuso America/Sao_Paulo via `formatDateTimeSaoPaulo`, mesmo
mecanismo do INC-020) e na lista do colaborador. O comprovante exportado (CSV de
confirmações) tinha ciência e hash, mas não publicação — coluna "Publicado em" adicionada.
Hash da versão lida: já estava exposto no comprovante (coluna `Hash`, `content_hash_at_ack`)
mesmo sem aparecer em tela — satisfaz o pedido ("na tela OU no comprovante"), não fiz
mudança adicional. Achado correlato durante a auditoria de formato: o rodapé do admin usava
`formatCalendarDate` (leitura de componentes UTC direto) num campo `publish_at`
(timestamptz) para o caso "agendado" — mesma classe de bug do INC-020, deslocava o dia
perto da virada de meia-noite em SP; trocado para `formatDateTimeSaoPaulo`.

**Fora de escopo, relatado e não tocado:** `deadline` de vaga (`JobOpening`, também
timestamptz) tem o mesmo padrão de uso de `formatCalendarDate` em 2 lugares
(`job-opening-card.tsx`, `cards/render/index.tsx`) — mesma classe de bug do INC-020, mas
fora do escopo deste bloco (comunicados). Fica como achado para o Pedro decidir se abre
INC/DP.

**Testes:** `tests/integration/announcement-ordering.test.ts` (novo) — grava `publish_at`
na publicação imediata; preserva `publish_at` de agendamento já devido; substitui por `now`
quando "publicar agora" antecipa um agendamento futuro; e o cenário pedido explicitamente
(agendado publicado depois de outro criado antes) verificado nas 3 listas. Ajustes em
testes existentes que assumiam o comportamento antigo:
`announcement-create-and-publish.test.ts` (esperava `publish_at: null` na publicação
imediata) e `announcement-ack-export.test.ts` (cabeçalho do CSV com a coluna nova).

**Validação:** `npm run lint && npm run typecheck && npm run build && npm run test` —
verdes, 351/351 testes (1 flaky pré-existente e não relacionado —
`immutability-triggers.test.ts`, deadlock de paralelismo entre arquivos de teste,
reproduzido isolado como verde). Verificação da ordenação contra o tenant de dev real
(consulta somente-leitura às 3 funções de lista) confirmou o efeito esperado: agendados
futuros primeiro, depois publicados em ordem decrescente de `publish_at`, arquivados por
último — antes da correção, os arquivados (criados por último no script do seed) apareciam
no topo por `created_at`. Sem navegador disponível neste ambiente (mesma limitação
registrada nos blocos anteriores); não fiz "seed do zero" (ação destrutiva sobre o tenant
de dev existente, bloqueada pelo classificador de segurança do ambiente) — validação
substituta: consulta funcional somente-leitura descrita acima.

`git grep` dos termos de `expressions.txt`: 2 ocorrências, as mesmas já reportadas nos
blocos 3.5–3.8 (citações entre aspas na narrativa deste próprio Registro de Conclusão) —
não é vazamento novo, nada deste bloco introduziu ocorrência.

Relatório completo: `C:\backups\inc027\bloco-3-9-inc027.md` (fora do repositório).

### Blocos 3.5–3.8, 3.10–3.11 (correções de produto e diagnóstico) — 2026-08-13

Índice — cada bloco tem relatório completo fora do repositório (`C:\backups\inc027\bloco-3-N-inc027.md`); esta entrada existia como lacuna no Registro de Conclusão até o Bloco 4 (achado do próprio Bloco 4, Passo 3): os commits estavam na `main`, mas nenhum resumo tinha sido escrito aqui.

- **Bloco 3.5 — correções antes das capturas.** **Defeito 1a, bug de produto 🔴 (o mais sério dos 6 encontrados nesta faixa):** o middleware (`src/middleware.ts`/`src/lib/tenant/slug-path.ts`) tratava o primeiro segmento de **qualquer** caminho sem ponto como candidato a slug de tenant — `/banners/home.png` virava `"/banners/login"` em vez de servir o arquivo estático, quebrando o banner da Home em **todo tenant**, não só no de demonstração. `RESERVED_SEGMENTS` passou a incluir `banners`/`branding`. Também corrigido: estado vazio ausente na seção "Aniversariantes" da Home e rótulos legíveis de categoria de comunicado. Commits: `573cd8e`, `ed29208`, `06bdf50`.
- **Bloco 3.6 — mídia e poda de refs.** **Defeito 1, bug de produto 🔴:** `HomeBanner` usava altura fixa (`max-h-52`) com `object-cover` sobre artes 16:9 — cortava até ~40% do conteúdo em qualquer proporção diferente da esperada; virou `aspect-[1920/650]` (proporção explícita, sem altura fixa). Orientação de dimensão do upload de logo corrigida. Commits: `e68c62a`, `f203da6`, `7f555f0`, `4f7b979`.
- **Bloco 3.7 — aviso de privacidade e atrito de senha.** Investigação do relato "`/aviso-privacidade` devolve 404": rota confirmada correta por código e por teste funcional repetido (200 em toda tentativa) — não reproduzido, hipótese registrada em **DP-39** (sessão sobrevivente a reset de volume do Postgres feito em blocos anteriores). Login direto no seed de demonstração ajustado. Commits: `15174b5`, `ebde610`.
- **Bloco 3.8 — banner 1920×650 e reversão de senha.** Padronização final de proporção do banner (2155×730, ~0,07% do alvo) e confirmação de que a troca de senha obrigatória no primeiro acesso (revertida antes, ver commits `76eaa31`/`a8756c5` no histórico principal) permanecia intacta. Commit: `7dbeb77`.
- **Bloco 3.11 — README e trava contra `migrate dev`.** **Bug de produto/documentação, causa raiz de um sintoma reportado como "bug de seed" ("senha de demonstração volta a `Trocar123!` a cada reinício"):** o `README.md` e a seção "Comandos" do `CLAUDE.md` recomendavam `npx prisma migrate dev` — comando que o próprio `ADR-008` já proíbe (a coluna `GENERATED` `search_vector` não é modelável pelo Prisma; `migrate dev` calcula diff espúrio contra essa coluna e pode disparar reset do banco + reseed automático, o que de fato explica o sintoma). Corrigido para `migrate deploy` nos dois arquivos (commit `b627389`). Registrado como **DP-40**: a mitigação continua sendo só documental — nenhuma trava técnica impede o mesmo comando de rodar de novo.

### Bloco 3.12 (bloco de comprovação na leitura do comunicado) — 2026-08-13

Consolidou publicação e ciência (que viviam em pesos visuais opostos — uma como subtítulo apagado, a outra num bloco separado) num único bloco na tela de leitura do colaborador, com peso visual igual entre as duas datas, intervalo legível em pt-BR entre elas (`describeAckInterval`, novo módulo puro testado), a versão do documento efetivamente confirmada (mesmo rótulo do CSV exportado) e uma menção discreta de integridade sem expor o hash.

**Bug de produto encontrado e corrigido no caminho:** `AnnouncementReaderState` nunca expunha qual versão foi de fato confirmada, só a mais recente — um comunicado com edição não-material publicada depois do ack (que corretamente não reabre pendência, ADR-001/INC-005) mostrava a ciência como se fosse sobre o texto atual, quando era sobre uma versão anterior. Campo `lastAckedVersionNumber` adicionado a `reader-state.ts`, coberto por teste de integração (cenário exato: ack em V1, V2 não-material publicada depois).

10 testes unitários novos (`ack-proof.test.ts`) + 2 asserções num teste de integração existente. 360/360 testes verdes. Sem navegador disponível neste ambiente (mesma limitação dos blocos anteriores); verificação feita por consulta funcional somente-leitura contra o tenant de dev real. DPs propostas (não implementadas): anexos na tela de leitura, filiais destinatárias visíveis ao colaborador, navegação de retorno explícita. Relatório completo: `C:\backups\inc027\bloco-3-12-inc027.md`.

### Bloco 4 (vitrine — README da raiz e índice do vault) — 2026-08-13

**README da raiz:** substituído pelo texto aprovado pelo Pedro, usado como está. Único ajuste de caminho: a imagem `docs/06-Design/screenshots/home-colaborador.png` referenciada no texto existe no disco como `home-colaborador.png.jpeg` (nome real do arquivo entregue) — corrigido o caminho no README, arquivo não renomeado. As 4 imagens referenciadas existem; os 4 links internos para `docs/` (ADR-001, 002, 006, 008, 009, 010, 011, `rotacao-pepper.md`, `visao-e-tese.md`, ADR-003) resolvem. Removida uma colchete `]` solta ao final do texto fornecido (artefato de transcrição do prompt, sem correspondência de abertura — não fazia sentido como Markdown; nenhum outro caractere do texto aprovado foi alterado).

Todas as afirmações técnicas do README foram verificadas contra o código real e **nenhuma divergência foi encontrada** — RLS forçada + política default-deny, teste de regressão de RLS, matriz de GRANTs nas 3 direções, trigger recusando `UPDATE`/`DELETE`/`TRUNCATE` mesmo contra a role owner, `INSERT ... ON CONFLICT ... RETURNING` na numeração com teste concorrente, as colunas exatas do CSV exportado (a coluna "Publicado em" do Bloco 3.9 já está refletida no texto do README), CPF só como hash com pepper (nunca em claro), e os três papéis com escopo de filial única por gestor. Números verificados (não inseridos no texto aprovado — reportados no relatório externo para o Pedro decidir onde/se inserir): 12 ADRs Aceitos, 29 arquivos de INC na `main` mais 2 (`INC-025`/`INC-026`) prontos em branch não mergeada, 19 de 21 tabelas de `public` com RLS forçada (as 2 sem RLS são `tenants` e `_prisma_migrations`, mesma exclusão do teste de guarda), 360 testes em 66 arquivos.

**`docs/README.md`:** reescrito como índice do vault (não duplica a vitrine da raiz) — mapa de pastas, convenção de status com o degrau 🟡 explicitado, e tabela dos 12 ADRs com status, substituindo a declaração "Fase de especificação (nenhuma linha de código escrita)" datada de 2026-07-09 (achado D5 do Bloco 0).

**Coerência de status (achado D5, Passo 3):** o próprio arquivo deste INC declarava `**Status:** ⬜ Não iniciado` e a linha do `roadmap.md` também — ambos desatualizados desde o Bloco 0. Corrigidos para `🔄 Em andamento`, com nota de quais blocos estão concluídos. Nenhuma outra declaração de status ativa (fora de auditorias datadas, que são retrato histórico e não foram alteradas) ficou divergente do estado real — verificado por varredura de `"fase de especificação"`, `"nenhuma linha de código"` e `"Não iniciado"` em `docs/`.

**INCs sem Relatório de Entrega formal** (heading `## Relatório de Entrega — INC-XXX`, formato definido em `docs/00-Processo/fluxo-de-trabalho.md`) — têm `Registro de conclusão` preenchido, mas não no formato canônico: INC-005, 006, 007, 008, 008.5, 012, 012.5, 013, 015, 020, 021, 023, 024. Não escritos retroativamente, apenas listados (pedido explícito do Bloco 4).

Relatório completo: `C:\backups\inc027\bloco-4-inc027.md`.

### Síntese do INC (Blocos 0–4)

**Desvio consciente do resíduo "Unigrão" (detalhe completo no Bloco 2 acima).** Um resíduo do termo "Unigrão" (nome de um LMS de terceiro — produto, não identificador do cliente-piloto nem do autor) permanece em texto de **um commit antigo** do histórico reescrito, fora do HEAD (já corrigido no HEAD). Decisão: não repetir o `filter-repo` só por isso — uma segunda passada trocaria os 237 SHAs novamente, invalidando as 51 citações de SHA já corrigidas nos Relatórios de Entrega, por um ganho marginal (termo de produto de terceiro, não vinculável a ninguém).

**Bugs de PRODUTO descobertos durante a preparação, que os 337 testes da época (antes dos blocos 3.9/3.12) não pegavam** — nenhum é bug de seed:
1. **Middleware tratando `/banners/` (e `/branding/`) como slug de tenant** (Bloco 3.5) — quebrava o banner da Home em **todo tenant**, não só no de demonstração; passou despercebido porque nenhum teste de integração exercitava uma rota estática por baixo do middleware de resolução de tenant.
2. **Proporção do banner de Aparência** (Bloco 3.6) — altura fixa com `object-cover` cortava até ~40% de artes fora de uma proporção específica; passou despercebido porque não havia teste de proporção nem verificação visual até a preparação da vitrine.
3. **`publish_at` nunca gravado na publicação imediata** (Bloco 3.9) — só o agendamento gravava o campo; toda publicação direta (o caminho mais comum) ficava com `publish_at = null` para sempre, afundando o item pro fim das listas ordenadas por data e deixando o comprovante exportado sem data de publicação. Suíte verde o tempo todo — os testes verificavam o *status* da publicação, nunca o `publish_at` resultante.
4. **Versão confirmada não exposta na leitura** (Bloco 3.12) — a tela de leitura nunca mostrava qual versão do documento foi de fato confirmada; um comunicado editado (não-materialmente) depois do ack podia exibir a ciência como se fosse sobre o texto atual, quando era sobre uma versão anterior.
5. **README e `CLAUDE.md` recomendando `prisma migrate dev`** (Bloco 3.11, DP-40) — comando que o próprio `ADR-008` proíbe por escrito; causa raiz confirmada de um sintoma que parecia bug de seed ("senha de demonstração volta ao padrão a cada reinício"), na verdade um reset de banco disparado pelo diff espúrio do `migrate dev` contra a coluna `GENERATED`.

Padrão comum aos 5: nenhum foi pego por "suíte verde" — cada um exigia olhar a tela renderizada, o dado gravado ou a documentação operacional, não só o resultado de uma asserção sobre o caminho feliz já coberto.

**Aprendizado de método.** Este INC foi especificado com 6 blocos, dimensionados **antes** de o Bloco 0 (auditoria read-only) investigar o que de fato precisava ser feito. O escopo teve que ser reescrito várias vezes conforme a auditoria e a preparação da vitrine revelavam trabalho não previsto (identificadores derivados no Bloco 0b, ~20 branches ressuscitadas pelo próprio `filter-repo`, 5 bugs de produto que não tinham nada a ver com "higiene de repositório"). Uma auditoria read-only que pode mudar o escopo do trabalho subsequente deveria ser **um INC próprio**, encerrado com relatório entregue ao Pedro, e o INC de execução deveria ser especificado **depois**, com o relatório em mãos — em vez de um único INC guarda-chuva que absorve o replanejamento como "blocos extras" (3.5 a 3.12) não planejados no arquivo original.

**DPs criadas ao longo do caminho:** DP-37 (demo pública em VPS, bloqueada por infraestrutura), DP-38 (✅ resolvida — nomes genéricos no seed), DP-39 (🟡 aviso de privacidade "404" reportado, não reproduzido, hipótese de sessão órfã pós-reset), DP-40 (🟡 ausência de trava técnica contra `migrate dev`, mitigação hoje 100% documental). Propostas nos Blocos 3.9 e 3.12 (não abertas como DP formal — ficam para o Pedro decidir se abre): fuso de `formatCalendarDate` aplicado a `JobOpening.deadline` (mesma classe de bug do INC-020, fora do escopo de comunicados); anexos na tela de leitura de comunicado; filiais destinatárias visíveis ao colaborador; navegação de retorno explícita na tela de leitura.

---

## Apêndice A — Tabela de substituição

| De | Para | Nota |
|---|---|---|
| Nome do cliente piloto (todas as grafias, com e sem acento, siglas) | Rede Vale Verde | |
| Slug `vale-verde` | `vale-verde` | **aparece na URL** (ADR-010), logo em toda screenshot |
| Nome do fornecedor do portal legado | "portal legado" / "sistema legado do fornecedor" | |
| Nome do ERP legado | "ERP legado" | |
| Filiais com nome de bairro real | Centro / Zona Norte / Distrito Industrial | bairro real vincula tanto quanto o nome da empresa |
| Cidade e estado (interior do RJ-RJ) | remover | **identificador mais forte que sobra** — cruzamento com o CV |
| Setor específico ("supermercado") | "varejo com operação multi-filial" | mantém a narrativa de problema real; remover por completo custaria valor de portfólio |
| IP / host / domínio de VPS, URL de túnel | remover; só via env | |
| **Pedro Catrinck** | **manter** | assinatura dos ADRs; é o portfólio |

**Identificadores derivados** — classe que a lista original não previa e que a execução do
Bloco 0 revelou (domínio de e-mail real em `VAPID_SUBJECT`, no `.env.example`). Rastrear e
substituir por valor fictício ou remover: domínio de e-mail, CNPJ, telefone, endereço de
filial, nome de bairro real, padrão de matrícula, site institucional e perfis sociais do
cliente. Vínculo não depende de o nome aparecer.

## Apêndice B — Expressions file do `filter-repo`

Formato: `literal==>substituto`, uma por linha. **Ordem importa** — expressões mais longas
e específicas primeiro, para evitar substituição parcial. Cobrir variações com e sem
acento, maiúsculas, siglas, slug e forma possessiva. O arquivo definitivo é montado a
partir do inventário do Bloco 0 / D3, e **não é versionado** (contém os termos que se
quer eliminar).
