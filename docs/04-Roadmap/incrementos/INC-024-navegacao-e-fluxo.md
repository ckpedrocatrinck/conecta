# INC-024 — Correções de navegação e fluxo (Módulo B)

**Status:** ✅ Concluído (2026-08-05) — Partes 1 e 2 implementadas, Parte 3 resolvida por decisão de produto + correção de doc, Parte 4 transferida para a DP-19
**Fase:** correção (pré-piloto)
**Origem:** teste manual real de 2026-08-04/05 (Pedro)
**Depende de:** INC-008, INC-010, INC-011

## Objetivo
Corrigir quatro problemas de navegação/fluxo identificados em teste manual real, no Feed e módulos adjacentes.

## Escopo

### Parte 1 — Link de aniversariantes sempre acessível
Hoje o link "Ver todos" na Home só aparece dentro do bloco condicional de aniversariantes de hoje (janela de 0 dias). Trocar para um link fixo, independente de haver aniversariante hoje, apontando para `/{slug}/aniversariantes` (rota já existe e funciona — confirmado por investigação em 2026-08-04). Texto sugerido: "Ver aniversariantes do mês". Não alterar o bottom nav (ADR-009, 5 slots já ocupados).

> **Desvio do texto sugerido (2026-08-05).** A rota de destino lista "hoje e os próximos 7 dias" (`WINDOW_DAYS = 7` em `aniversariantes/page.tsx`), não o mês. O rótulo entregue é **"Ver próximos aniversários"**, para o link não prometer uma janela que a tela não mostra. Trocar a janela da rota de 7 dias para o mês corrente é decisão de produto, fora do escopo desta parte — **pendência para o Pedro decidir**; se ele quiser o mês, o rótulo sugerido volta junto com a mudança de janela.

### Parte 2 — error.tsx em /[slug] (DP-30 / GAP-09)
Falta error boundary na árvore do tenant; hoje um erro de runtime nessa árvore cai na tela genérica em inglês do Next. Replicar o padrão de `src/app/error.tsx` (raiz) para `src/app/[slug]/error.tsx` — client component, props `error`/`reset`, mensagem em pt-BR, botão de tentar novamente (`reset()`), mesmo estilo visual (`EmptyState` ou equivalente) do resto do produto.

> **Correção de premissa (2026-08-05).** A parte "cai na tela genérica em inglês do Next" **não se confirmou**. O boundary da raiz (`src/app/error.tsx`, Q1 do INC-012.5) já cobria o subtree `/{slug}` — pelo contrato do App Router, `error.tsx` captura os erros dos segmentos **filhos**, não só os do próprio nível. Verificado em **build de produção** com erro real forçado dentro de `/{slug}/login`: o servidor registrou a exception (`⨯ Error: … digest: 1290664437`) e a resposta veio com o shell do app + o chunk do boundary em pt-BR — nenhum "Application error" em nenhum ponto.
>
> O arquivo novo **continua valendo**, por outro motivo: ser **tenant-aware**. O boundary da raiz manda o usuário para `/`, que para um colaborador logado é um beco (a raiz é institucional/seleção). O boundary do tenant manda para `/{slug}`, a home da empresa. Entregue com essa justificativa, não com a original.

### Parte 3 — Vaga publicada não gera card no feed (investigar antes)
INC-011, item 5, especifica: "Vaga publicada gera card (template INC-009) no feed." Não está acontecendo. Investigar onde esse disparo deveria ocorrer (comparar com o padrão já existente de comunicado/aniversário, que geram card corretamente) e por que não dispara — nunca foi implementado, foi implementado em outro lugar e desconectado, ou removido em refactor. Se a investigação revelar decisão de arquitetura não óbvia, PARAR e reportar antes de implementar.

> **🛑 PARADO na investigação (2026-08-05) — depende de decisão de produto/arquitetura do Pedro.**
>
> **Não existe defeito a corrigir.** O que existe é uma diferença entre o texto do INC-011 e o que foi construído:
>
> 1. **Não há mecanismo de "gerar card" no produto.** O feed é 100% `Post`: `findPostsForFeed` filtra `status = 'published'` na tabela `posts` e pagina por keyset `(eventDate, createdAt, id)`. O **único** caminho que cria `Post` no código é o scaffold de "Novo post" do admin (`createOrReuseDraftAction`) — nada mais, em nenhum lugar, cria linha de `Post` automaticamente.
> 2. **A premissa "comunicado/aniversário geram card corretamente" não se confirma.** Nenhum dos dois gera card **no feed**: comunicado não renderiza `CardTemplate` em lugar algum (tem bloco de ação próprio na Home + lista em `/comunicados`); aniversariante renderiza `CardTemplate`, mas na **própria seção** da Home ("Aniversariantes de hoje"), fora da timeline do feed. O padrão real do produto é **seção própria por entidade**, não timeline unificada.
> 3. **Vaga já segue esse padrão real.** `jobOpeningToCardData` + `CardTemplate` renderizam o card do INC-009 na seção "Vagas abertas" da Home (3 primeiras, com "Ver todas") e em `/vagas`. O commit único do INC-011 (`101bf73`) descreve exatamente isso no corpo: *"integracao do card do INC-009 na home/lista"*. Ou seja: **nunca foi implementado no feed** — não foi desconectado nem removido em refactor (`git log -S` não mostra nenhuma passagem de vaga pela camada de feed).
> 4. **A query da vaga está correta**, então não é caso de card "sumindo": `findOpenJobOpeningsForEmployee` filtra `status = 'open'` + `deadline > now`, sem restrição de filial — vaga aberta com prazo futuro aparece para todo mundo.
>
> **A decisão que falta:** colocar vaga **dentro da timeline do feed** significa misturar duas tabelas numa lista paginada por cursor de `Post`. Caminhos possíveis, todos com consequência:
>
> | Caminho | Custo | Consequência |
> |---|---|---|
> | **A. Denormalizar** — publicar vaga cria um `Post` | migração (novo valor no enum `PostType`), regras de sincronia | duas fontes de verdade: editar/fechar vaga precisa refletir no post |
> | **B. União na query** — feed lê `Post` ∪ `JobOpening` | reescrever o cursor de paginação (precisa discriminar origem) + a API do "carregar mais" | modelo de feed mais complexo, mas fonte única |
> | **C. Injetar só na 1ª página** — vagas abertas entram no topo do feed, sem cursor | baixo | vaga se comporta diferente de post ao paginar |
> | **D. Não fazer** — considerar o item 5 atendido pela seção "Vagas abertas" | zero | exige **corrigir o texto do INC-011**, que hoje promete "no feed" |
>
> Nenhum desses é escolha de executor (regra 1 do CLAUDE.md). **Aguardando o Pedro escolher** — só depois dá para escrever o critério de aceite real desta parte.
>
> ---
>
> **✅ DECIDIDO (Pedro, 2026-08-05): caminho D.** Vaga **não** entra na timeline do feed de posts; o item 5 do INC-011 passa a ser atendido pela seção "Vagas abertas" da Home + `/vagas`, que é o que já existe e funciona. **Motivo:** o custo de arquitetura dos caminhos A e B não se justifica sem evidência de que descoberta *no feed* importa mais que a seção dedicada. **Consequência:** zero mudança de código — a correção é de documentação, no texto do item 5 do `INC-011-vagas-internas.md`, que prometia "no feed" e nunca foi implementado assim. Se o piloto trouxer evidência de que a seção não gera descoberta suficiente, a decisão pode ser revisitada com A/B/C ainda na mesa.

### Parte 4 — Upload de foto no post publica direto, sem confirmação (investigar antes)
Ao anexar foto durante a criação de um post, ela sobe/fica pública imediatamente, sem esperar a publicação do post. Investigar o fluxo atual: o attach persiste algo do post prematuramente? Existe estado de rascunho sendo pulado? Qual o comportamento hoje vs. o esperado. Se envolver decisão de UX não óbvia (ex.: introduzir estado de rascunho onde não existia), PARAR e reportar antes de implementar.

> **🛑 PARADO na investigação (2026-08-05) — é a DP-19, já registrada, e o conserto limpo depende do R2.**
>
> **Fluxo real, passo a passo:**
>
> 1. "Novo post" **não abre formulário**: chama `createOrReuseDraftAction`, que **cria a linha `Post` (status `draft`) antes de o admin digitar qualquer coisa** e redireciona para a tela de compor. Isso é deliberado e documentado no próprio código: a chave do storage é `posts/{tenantId}/{postId}/…`, ou seja **precisa do `postId`**, que só existe depois de a linha nascer.
> 2. Anexar arquivo (`PostPhotoUpload`) faz: `requestPostAttachmentUploadUrl` → **PUT direto no storage** (presigned, com barra de progresso) → `confirmPostAttachmentUploadAction`, que valida tipo real por sniff/tamanho e cria a linha `PostMedia`. **Não há etapa de confirmação do usuário** — selecionar o arquivo já envia. É o desenho do INC-016 (upload direto, sem passar o arquivo pela Server Action).
> 3. **Resposta ao "o attach persiste algo prematuramente?"**: sim, e mais do que o anexo — **o post inteiro** já existe como rascunho antes do attach. Não há estado de rascunho "sendo pulado"; há o oposto, um rascunho criado cedo de propósito.
> 4. **Resposta ao "fica pública?"**: **não aparece para colaborador em nenhuma tela** — o feed filtra `status = 'published'`. Mas *pública* no sentido de acesso direto tem uma ressalva real: `authorizeMediaKey` libera `view` de `posts/{tenantId}/{postId}/*` para **qualquer sessão ativa do tenant**, sem olhar o `status` do post. Não é descobrível (a chave/`mediaId` é uuid e não está linkada em lugar nenhum), mas a regra de autorização hoje é "é do meu tenant", não "é de post publicado".
>
> **Por que parei:** o conserto certo é exatamente o que a **DP-19** já descreve — *staging por sessão* (`_staging/{sessão}/…` com rekey do objeto no salvar), para nenhum rascunho nascer só para hospedar anexo. Ela está registrada como **solução temporária consciente** e **depende do R2 real**, porque rekeyar = mover objeto no storage (copy+delete), operação que o mock de disco local não expõe de forma production-safe. Introduzir estado de rascunho/pendente de mídia aqui é justamente a "decisão de UX não óbvia" que o escopo manda parar antes de fazer — e desfaria uma escolha de arquitetura já registrada.
>
> **Dois achados adjacentes, para o Pedro decidir se quer registrar como DP:**
> - **(a) Autorização de mídia ignora o status do post** (ver item 4 acima). Fechar isso é uma condição a mais em `authorizeMediaKey`/`/api/anexo` ("só mídia de post publicado, exceto para admin") — mudança pequena, mas é regra de acesso, não ajuste de UI.
> - **(b) Rascunho abandonado COM anexo não tem limpeza.** A varredura de órfãos só apaga rascunhos **pristine** (`findPristineDraftsByAdmin`: sem título, texto, pessoas **nem mídia**) — anexar arquivo tira o rascunho dessa condição. Resultado: rascunho abandonado com foto fica para sempre no banco **e** o objeto no storage, ou seja, **foto de pessoa persistida sem nunca ter sido publicada** (minimização/retenção da LGPD). A DP-19 já cita "orphan-sweep de objetos não-confirmados" no conjunto de dívidas do R2, mas não este caso específico (objeto *confirmado*, post nunca publicado).

## Critérios de aceite
- [x] Link de aniversariantes aparece na Home todos os dias, independente de haver aniversariante hoje. (`src/app/[slug]/(app)/page.tsx` — link fora da condicional dos cards do dia; rótulo "Ver próximos aniversários", ver desvio na Parte 1.)
- [x] Erro de runtime real dentro de `/{slug}/*` mostra tela em pt-BR com botão de tentar novamente, não a tela genérica em inglês. (`src/app/[slug]/error.tsx`; verificado em build de produção com erro forçado — ver Parte 2, incluindo a correção da premissa.)
- [x] ~~Vaga publicada gera card visível no feed~~ → **critério substituído pela decisão de produto (caminho D, Pedro, 2026-08-05):** vaga gera card na Home (seção "Vagas abertas") e em `/vagas`, **não** na timeline do feed de posts. Isso já era o comportamento real; o que estava errado era o texto do item 5 do INC-011, corrigido nesta rodada. Sem mudança de código.
- [ ] ~~Anexar foto durante criação de post não a torna pública/permanente antes da publicação~~ — **transferido para a DP-19** (não é pendência deste INC): o conserto limpo (staging por sessão + rekey) depende do R2 real. Achados adjacentes promovidos a **DP-33** e **DP-34** (ver Parte 4).
- [x] `npm run lint && npm run typecheck && npm run test && npm run build` verdes.

## Registro de conclusão
**Data:** 2026-08-05
**Branch:** `inc-024-navegacao-e-fluxo`
**Merge em main:** `--no-ff` em 2026-08-05 (hash preenchido no commit seguinte ao merge)

### Situação final — as 4 partes fechadas
| Parte | Situação |
|---|---|
| **1 — link de aniversariantes** | ✅ **implementada** (`d17dad6`) |
| **2 — `error.tsx` do tenant** | ✅ **implementada** (`7285370`) — resolve a **DP-30**, com a premissa dela corrigida |
| **3 — card de vaga no feed** | ✅ **resolvida por correção de documentação** — decisão do Pedro pelo caminho **D** (2026-08-05): o comportamento atual (seção "Vagas abertas" + `/vagas`) é o correto; o texto do item 5 do `INC-011-vagas-internas.md` foi corrigido, porque prometia "no feed" e isso nunca existiu. **Sem mudança de código.** |
| **4 — foto do post** | ⏭️ **transferida para a DP-19** — não é pendência deste INC. O conserto limpo (staging por sessão + rekey) depende do R2 real; 2 achados adjacentes promovidos a **DP-33** e **DP-34**. |

### DPs movimentadas nesta rodada
| DP | Movimento |
|---|---|
| **DP-30** | ✅ **resolvida** (Parte 2), movida para "Resolvidas em 2026-08-05" com a premissa corrigida |
| **DP-33** | 🆕 aberta — `authorizeMediaKey` libera `view` de mídia de post por tenant sem olhar o `status` do post |
| **DP-34** | 🆕 aberta — rascunho abandonado **com** anexo nunca é limpo (foto de pessoa persistida sem nunca ter sido publicada; retenção/LGPD) |
| **DP-35** | 🆕 aberta — deadlock 40P01 (`TRUNCATE CASCADE` vs escrita concorrente) reincidente; **reabre a conclusão do GAP-15**, que a auditoria de 2026-07-27 havia fechado como "não reproduzível" |
| **DP-19** | permanece aberta e passa a ser a dona da Parte 4 |

### O que foi entregue
- **Parte 1 (`d17dad6`)** — link para `/{slug}/aniversariantes` fixo na Home. Antes ele existia só dentro do bloco de aniversariantes de hoje (janela de 0 dias): em qualquer dia sem aniversariante, a rota ficava **sem nenhum caminho de navegação** (o bottom nav não a lista — ADR-009, 5 slots ocupados — e nada mais aponta para ela). O cabeçalho alterna entre "Aniversariantes de hoje" e "Aniversariantes"; a linha do link é fixa. Sem elemento visual novo: reusa o padrão de cabeçalho + link das seções Vagas/Benefícios da própria Home.
- **Parte 2 (`7285370`)** — `src/app/[slug]/error.tsx`, Client Component em pt-BR com `ErrorState` + "Tentar novamente" (`reset()`), reporte opcional ao log do servidor pela flag do INC-022, e link de saída para `/{slug}` (não para `/`). **DP-30 movida para "Resolvidas em 2026-08-05"** com a premissa corrigida.
- **Fora das 4 partes, mas achado por este INC (`93f80f5`)** — correção do agendador do INC-023 no `docker-compose.yml`: `date -u '+%H'` sempre devolve 2 dígitos, então comparar direto com `ANONYMIZE_AT_HOUR_UTC` quebrava com `3` (o valor que o próprio `.env.example` documenta) — a anonimização diária nunca rodaria **e nunca logaria FALHA**, porque a chamada não era nem tentada. Normalizado com `pad2` (um char → prefixa zero) aplicado uma vez no boot. Verificado fora do container com o script **real** extraído do compose e relógio stubbado: com `3` e com `03`, às 03 UTC as duas chamadas saem; às 02 UTC só a de publicação. Matriz auxiliar de 11 casos (`0`/`00`, `3`/`03`, `10`, `23`) toda ok; `docker compose --profile scheduler config` segue válido.
- **DP-33 e DP-34 (`17d1a9d`)** — os dois achados adjacentes da Parte 4 registrados como DP próprias (antes estavam só descritos aqui).

### Decisões e correções de premissa
1. **A premissa da Parte 2 estava errada** (mesmo padrão do INC-023): o boundary da raiz já cobria `/{slug}` — `error.tsx` captura os segmentos filhos. O ganho real do arquivo novo é ser tenant-aware, e foi entregue com essa justificativa, não com a de "erro cru em inglês".
2. **Rótulo do link de aniversariantes divergiu do texto sugerido** ("Ver aniversariantes do mês" → "Ver próximos aniversários"), porque a rota mostra 7 dias, não o mês. Mudar a janela é decisão de produto.
3. **Parte 3 parada** sem tocar em código: não há defeito, há divergência entre o texto do INC-011 e o padrão real do produto (seção própria por entidade, não timeline unificada). 4 caminhos possíveis mapeados na Parte 3, todos com consequência de arquitetura — escolha do Pedro (regra 1 do CLAUDE.md).
4. **Parte 4 parada** sem tocar em código: é a **DP-19**, escolha temporária consciente e bloqueada no R2. Mexer aqui desfaria arquitetura já registrada.

### Verificações
- Gate completo verde em 2026-08-05: `lint` limpo, `typecheck` limpo, **61 arquivos / 327 testes** passando (21,2s), `build` concluído. Repetido no fechamento parcial (após a correção do agendador e as DPs): lint e typecheck limpos, 61/327 verdes, build concluído.
- **Flake observado no fechamento parcial (não é regressão):** na primeira rodada, `tests/integration/immutability-triggers.test.ts` falhou com `40P01 deadlock detected` — o teste de TRUNCATE pede `AccessExclusiveLock` enquanto outro arquivo em paralelo segura `RowExclusiveLock`. Passou na repetição imediata (61/327). Nada do commit podia causar isso (as mudanças foram `docker-compose.yml` + docs) e havia um `npm run dev` ativo no mesmo banco, somando contenção. É um mecanismo **diferente** do que o A7-1 do INC-012.5 estabilizou (lá era `session_replication_role` na limpeza; aqui é lock de TRUNCATE contra escritor concorrente) — vale registrar como DP se reaparecer no CI.
- Boundary do tenant verificado em **build de produção** (não em dev — em dev o overlay do Next mascara qual boundary responde): erro real forçado dentro de `/{slug}/login`, exception registrada no servidor e o chunk do boundary novo (string exclusiva "Algo deu errado ao carregar esta página") presente na resposta da rota que falhou. A rota temporária de teste foi removida e a alteração temporária do `login/page.tsx` revertida — nada disso entrou em commit.
- **Limite da verificação:** o boundary do App Router é renderizado no cliente após a hidratação, e não há navegador headless no repo (sem jsdom/Playwright — ver DP-21/DP-28). A confirmação **visual** (tela em pt-BR + clique no "Tentar novamente") depende de um teste manual do Pedro.

### Pendências que este INC deixa registradas
- ~~**Parte 3** — Pedro escolher entre os caminhos A/B/C/D.~~ ✅ **Fechada: caminho D**, texto do INC-011 corrigido. Revisitável se o piloto mostrar que a seção dedicada não gera descoberta suficiente.
- **Parte 4** — segue na DP-19, quitável junto do R2. Os dois achados adjacentes deixaram de ser observação e viraram registro próprio: **DP-33** (`authorizeMediaKey` libera `view` de mídia de post por tenant, sem olhar o `status` do post) e **DP-34** (rascunho abandonado **com** anexo nunca é limpo — a varredura só apaga rascunhos *pristine* —, deixando foto de pessoa persistida sem nunca ter sido publicada; minimização/retenção da LGPD).
- **Janela da tela de aniversariantes**: 7 dias vs. mês corrente.
- ~~**⚠️ `.env.example` — `SCHEDULER_ANONYMIZE_AT_HOUR_UTC=3` não funciona como está.**~~ ✅ **Resolvido em `93f80f5`** (fechamento parcial de 2026-08-05), pelo lado do compose: a comparação passou a normalizar a hora para 2 dígitos (`pad2`), então `3` e `03` funcionam igual e as 3 linhas do `.env.example` seguem válidas como o Pedro as escreveu. O risco original era o pior tipo: a anonimização diária **nunca rodaria e nunca logaria FALHA**, porque a chamada não era nem tentada — o "cron mudo" que o INC-023 existe para evitar.
