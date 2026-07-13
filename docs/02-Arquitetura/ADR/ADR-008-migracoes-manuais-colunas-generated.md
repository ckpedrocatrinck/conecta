# ADR-008 — Migrações manuais para tabelas com colunas GENERATED (search_vector)

**Status:** Aceito
**Aceito em:** 2026-07-13 (Pedro Catrinck)
**Data:** 2026-07-13
**Decisores:** Pedro Catrinck
**Relaciona-se com:** ADR-003 (RLS por tenant), INC-002, INC-003, INC-007

## Contexto
O INC-002 criou `announcement_versions.search_vector`, uma coluna `tsvector`
**gerada pelo Postgres** (`GENERATED ALWAYS AS (to_tsvector('portuguese', ...))
STORED`), usada para a busca full-text pt-BR dos comunicados (índice GIN). O
Prisma não modela colunas `GENERATED` nativamente — a coluna foi criada via
SQL bruto dentro da migration `rls_and_triggers` (INC-002), e no
`schema.prisma` só é representável como `Unsupported("tsvector")?`: o Prisma
sabe que a coluna existe (e não tenta apagá-la), mas não consegue expressar a
expressão gerada em si, nem o Prisma Client lê/escreve nesse campo.

Essa omissão, no entanto, tem um efeito colateral no fluxo normal de trabalho:
sempre que uma migração nova cria ou altera qualquer tabela, `prisma migrate
dev` calcula o diff comparando o banco atual contra o histórico de migrations
replayado numa shadow database. Esse diff tenta reconciliar `search_vector`
como se fosse uma coluna comum com `DEFAULT`, gerando um passo do tipo:

```sql
ALTER TABLE "announcement_versions" ALTER COLUMN "search_vector" DROP DEFAULT;
```

O Postgres recusa esse comando porque a coluna é `GENERATED` (o erro correto é
`ALTER COLUMN ... DROP EXPRESSION`, não `DROP DEFAULT`) — a migração falha ao
aplicar (`P3018`) e o `prisma migrate dev` fica bloqueado até o erro ser
resolvido manualmente.

Isso já aconteceu três vezes:
- **INC-002** — na própria migration que criou `search_vector`.
- **INC-003** — ao adicionar campos/tabelas de sessão e usuário.
- **INC-007** — ao adicionar a tabela `notifications`.

Nas três, a solução foi a mesma: gerar/escrever a migração à mão, sem o passo
indevido sobre `search_vector`, e aplicar com `prisma migrate deploy` (que não
faz o diff via shadow database — só executa migrations pendentes em ordem).
Sem registrar isso, os próximos INCs que criam tabela (INC-008 feed, INC-011
vagas, INC-012 push) vão redescobrir o mesmo erro do zero.

## Decisão
**Toda migração que cria ou altera tabela neste projeto é escrita/ajustada à
mão e aplicada com `prisma migrate deploy` — nunca com `prisma migrate dev`**,
por causa da coluna `GENERATED` `search_vector`.

Procedimento padrão (revisado em 2026-07-13 — ver seção "Entrada órfã em
`_prisma_migrations`" abaixo para o porquê da revisão; usado desde então):

1. Editar `schema.prisma` normalmente (novos models/campos — nunca modelar
   `search_vector` ali).
2. Rodar `npx prisma migrate dev --create-only --name <nome>` para **gerar o
   SQL sem aplicar**. Com `--create-only` o Prisma nunca tenta rodar o SQL
   contra o banco, então nunca grava nada em `_prisma_migrations` — não há
   apply parcial, não há estado de falha para limpar depois (ver validação
   na seção abaixo). **Não usar `npx prisma migrate dev --name <nome>` sem
   `--create-only`** — essa forma tenta aplicar de verdade, falha no passo do
   `search_vector` (P3018) e deixa uma entrada `rolled_back_at` no histórico
   do banco sem pasta correspondente em disco (era o procedimento antigo,
   causa raiz do problema documentado abaixo).
3. Editar o próprio arquivo gerado
   (`prisma/migrations/<timestamp>_<nome>/migration.sql`), removendo
   qualquer `DROP INDEX ..._search_vector_idx` / `ALTER COLUMN
   "search_vector" DROP DEFAULT` indevido — só sobra o que de fato muda
   (tabelas/colunas novas). **Não é preciso apagar a pasta nem trocar o
   timestamp**: como nada foi aplicado no passo 2, esta pasta não carrega
   nenhum estado de falha — editar no lugar é seguro.
4. Se a migração criar tabela de domínio nova, completar à mão o bloco de
   **GRANT mínimo + Row-Level Security por `tenant_id`**, no mesmo padrão de
   `sessions_rls_and_grants` (INC-003) e `inc007_notifications` (INC-007):
   ```sql
   GRANT SELECT, INSERT[, UPDATE][, DELETE] ON <tabela> TO conecta_app;

   ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY;
   ALTER TABLE <tabela> FORCE ROW LEVEL SECURITY;

   CREATE POLICY tenant_isolation ON <tabela>
     USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
     WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
   ```
   (Grant é o mínimo necessário por tabela — nunca `GRANT ALL`; tabelas
   append-only recebem só `SELECT, INSERT`, como já documentado no topo da
   migration `rls_and_triggers`.)
5. Aplicar com `npx prisma migrate deploy` (não `migrate dev`) e depois
   `npx prisma generate`.
6. Confirmar com `npx prisma migrate status` que não há migração pendente/
   falha.

## Entrada órfã em `_prisma_migrations` — causa, remediação e prevenção

**O que aconteceu:** o procedimento original (antes da revisão de
2026-07-13) mandava rodar `npx prisma migrate dev --name <nome>` **sem**
`--create-only` — essa forma tenta aplicar o SQL gerado de verdade. Como
sempre falha no passo do `search_vector` (P3018, por desenho — é exatamente
o problema que este ADR existe para contornar), o Prisma grava uma linha em
`_prisma_migrations` com `finished_at = NULL` antes de falhar. O passo
seguinte do procedimento antigo (`migrate resolve --rolled-back`) só marca
essa linha como `rolled_back_at = <agora>` — não a remove. Como o passo
seguinte manda apagar a pasta gerada e recriar uma com timestamp novo, essa
linha fica **permanentemente órfã**: presente no histórico do banco, sem
pasta correspondente em disco.

**Efeito:** `prisma migrate dev` (mesmo com `--create-only`, usado só para
inspecionar o diff) recusa rodar enquanto existir qualquer linha em
`_prisma_migrations` sem pasta em disco — ele pede `migrate reset` (apagaria
todos os dados). `prisma migrate deploy`/`migrate status` não são afetados
(por isso o problema passou despercebido até alguém precisar gerar SQL de
novo).

**Isto é evitável, não inevitável** — confirmado empiricamente (2026-07-13,
contra bancos descartáveis, nunca contra dados reais antes de validar):
usar `--create-only` desde o início (passo 2 da seção acima) faz o Prisma
**nunca gravar nenhuma linha** em `_prisma_migrations`, mesmo quando o diff
gerado inclui uma mudança real de schema — testado gerando o diff de
"adicionar `posts.branch_id`" contra um banco com só as migrations
anteriores aplicadas: a contagem de linhas em `_prisma_migrations` não mudou
depois do `--create-only`. Sem apply, não há falha; sem falha, não há
`rolled_back_at`; sem `rolled_back_at` órfão, `migrate dev` nunca mais pede
reset por essa causa. A revisão de procedimento acima (passos 2-3) elimina o
problema na origem — **a partir de agora, este cenário não deveria voltar a
acontecer se o procedimento revisado for seguido**.

**Remediação aplicada em 2026-07-13** (para a única entrada órfã que já
existia, sobra do INC-007 — `20260713115605_inc007_notifications`,
`finished_at IS NULL`, `rolled_back_at` preenchido, `applied_steps_count=0`):

```sql
-- Exemplo real aplicado em 2026-07-13 (troque migration_name se reaparecer
-- com outro nome no futuro):
DELETE FROM _prisma_migrations
WHERE migration_name = '20260713115605_inc007_notifications'
  AND rolled_back_at IS NOT NULL
  AND finished_at IS NULL
  AND applied_steps_count = 0;
```

O `WHERE` composto é deliberado: só casa com uma linha que nunca terminou,
foi explicitamente marcada como rolled-back, e não aplicou nenhum passo —
não há forma de essa condição atingir uma migração que de fato alterou o
schema. Validado antes de tocar o banco real: reproduzido o problema num
banco descartável (inserindo uma linha sintética idêntica), confirmado que
o mesmo `DELETE` resolve (`migrate dev --create-only` volta a rodar sem
pedir reset, `migrate status` limpo), só então aplicado contra `conecta_dev`.

**Se este cenário reaparecer no futuro** (ex.: alguém rodar `migrate dev`
sem `--create-only` por engano, ou uma versão futura do Prisma mudar esse
comportamento): o `DELETE` acima, com a mesma condição composta, é o
remédio — rodar antes de qualquer `migrate dev` voltar a ser necessário, no
mesmo INC/chore em que a entrada órfã for identificada (não deixar
acumular).

## Alternativas consideradas
- **Modelar `search_vector` como campo gerenciado pelo Prisma (não
  `Unsupported`)** — rejeitada: o Prisma não suporta coluna
  `GENERATED`/computed column nativamente (não há atributo para declarar a
  expressão gerada); a única forma de sair de `Unsupported("tsvector")?`
  seria tratá-la como campo comum gravável pela aplicação, o que quebraria a
  garantia de que o índice de busca é sempre derivado de `title`/`body` pelo
  próprio Postgres, não por escrita manual.
- **Abandonar a busca full-text nativa (Postgres `tsvector`/GIN) em favor de
  algo que o Prisma modele de forma nativa** — rejeitada: a busca do INC-004
  depende exatamente desse índice; trocar de abordagem (ex.: busca em
  aplicação, serviço externo) é um custo/complexidade muito maior para
  resolver um atrito de tooling, não um problema de produto.

## Consequências
+ Nenhuma mudança de schema por INC volta a travar horas em um erro já
  conhecido — o procedimento é copiável.
+ O padrão de GRANT+RLS por tabela nova fica documentado num único lugar
  (antes só existia implícito nas migrations anteriores).
+ (2026-07-13) O procedimento revisado (`--create-only` em vez de
  `migrate dev --name` puro) elimina a causa raiz das entradas órfãs em
  `_prisma_migrations` — não é mais preciso confiar em disciplina para
  limpar depois; o passo que causava o problema simplesmente não existe
  mais no procedimento.
− Toda migração de tabela exige um passo manual extra (editar o SQL gerado
  antes de aplicar) — dívida de tooling aceita conscientemente, não um bug a
  corrigir agora.
− Risco de regressão se alguém (Claude Code ou Pedro) esquecer este ADR e
  rodar `prisma migrate dev` direto em produção/CI — mitigado por este
  documento ser referenciado em `CLAUDE.md`, `stack.md` e no topo do
  `schema.prisma`, os três lugares que qualquer sessão de trabalho neste
  projeto já lê.

## Gatilho de revisão
O Prisma passar a suportar colunas `GENERATED`/computed columns nativamente
(haveria como declarar `search_vector` no `schema.prisma` e o diff pararia de
tentar alterá-la) — reavaliar se `prisma migrate dev` volta a ser seguro para
este projeto.
