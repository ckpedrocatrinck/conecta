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

Procedimento padrão (o mesmo usado nos INCs 002/003/007):

1. Editar `schema.prisma` normalmente (novos models/campos — nunca modelar
   `search_vector` ali).
2. Rodar `npx prisma migrate dev --name <nome>` **apenas para gerar o SQL** —
   ele vai falhar ao aplicar (esperado). Copiar o SQL gerado em
   `prisma/migrations/<timestamp>_<nome>/migration.sql`.
3. Rodar `npx prisma migrate resolve --rolled-back "<timestamp>_<nome>"` para
   limpar o estado de migração falha no histórico do banco.
4. Apagar a pasta de migração gerada e recriar uma nova (timestamp posterior),
   removendo do SQL copiado qualquer `DROP INDEX .../ ALTER COLUMN
   "search_vector" ...` indevido — só sobra o que de fato muda (as tabelas/
   colunas novas).
5. Se a migração criar tabela de domínio nova, completar à mão o bloco de
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
6. Aplicar com `npx prisma migrate deploy` (não `migrate dev`) e depois
   `npx prisma generate`.
7. Confirmar com `npx prisma migrate status` que não há migração pendente/
   falha.

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
