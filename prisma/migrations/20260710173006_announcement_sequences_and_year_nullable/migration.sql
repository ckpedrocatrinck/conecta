-- AlterTable
-- Nao tocar em search_vector/seu indice GIN aqui: e' coluna GENERATED ALWAYS
-- STORED criada via SQL puro na migration rls_and_triggers, que o Prisma nao
-- modela via schema.prisma (Unsupported) e cujo diff detectou como "drift"
-- por engano (nao ha' mudanca real pretendida nela nesta migration).
ALTER TABLE "announcement_versions" ADD COLUMN     "is_material_change" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "announcements" ALTER COLUMN "year" DROP NOT NULL;

-- CreateTable
CREATE TABLE "announcement_sequences" (
    "tenant_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "announcement_sequences_pkey" PRIMARY KEY ("tenant_id","year")
);

-- ---------------------------------------------------------------------------
-- RLS + grants (INC-004) — mesmo padrao da migration rls_and_triggers do
-- INC-002. announcement_sequences precisa de UPDATE (unico contador que nao
-- e' append-only) para o UPSERT atomico de numeracao em
-- src/lib/repositories/announcement-sequence.repository.ts.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON announcement_sequences TO conecta_app;

ALTER TABLE announcement_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_sequences FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON announcement_sequences
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
