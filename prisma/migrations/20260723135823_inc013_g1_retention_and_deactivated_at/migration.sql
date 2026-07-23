-- INC-013 G1 — anonimizacao de desligados (ADR-006 §3).
-- Escrita a mao / aplicada com `prisma migrate deploy` (ADR-008): o diff gerado
-- pelo `migrate dev --create-only` incluia o ruido conhecido da coluna GENERATED
-- `search_vector` (DROP INDEX ..._search_vector_idx + ALTER COLUMN ... DROP
-- DEFAULT), descartado aqui por nao ser uma mudanca real de schema.
-- So' colunas novas (sem tabela nova) -> os GRANTs de tabela existentes em
-- `tenants`/`users` (SELECT/INSERT/UPDATE) ja cobrem as colunas; sem bloco RLS.

-- Prazos de retencao LGPD, configuraveis por tenant (defaults propostos, DP-06).
ALTER TABLE "tenants" ADD COLUMN     "ack_retention_months" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "retention_months" INTEGER NOT NULL DEFAULT 24;

-- Data do desligamento: base de contagem do prazo de retencao (nao o updated_at).
ALTER TABLE "users" ADD COLUMN     "deactivated_at" TIMESTAMPTZ;
