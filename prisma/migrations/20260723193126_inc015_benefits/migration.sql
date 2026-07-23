-- INC-015: Clube de Beneficios / Parceiros. Tabela `benefits` multi-tenant
-- (vitrine informativa que a empresa-cliente oferece aos seus funcionarios).
--
-- Escrita a mao / aplicada com `prisma migrate deploy` (ADR-008): o diff gerado
-- por `prisma migrate dev --create-only` incluia o ruido conhecido da coluna
-- GENERATED `announcement_versions.search_vector`
-- (`DROP INDEX ..._search_vector_idx` + `ALTER COLUMN search_vector DROP
-- DEFAULT`), descartado aqui por nao ser mudanca real. Esta migration so'
-- contem o que de fato muda (enum + tabela + grant + RLS).

-- CreateEnum
-- Valores em minusculo, alinhados a convencao dos demais enums (open/admin/etc.)
-- — ver comentario do enum BenefitCategory em schema.prisma.
CREATE TYPE "BenefitCategory" AS ENUM ('saude', 'lazer', 'educacao', 'alimentacao', 'outros');

-- CreateTable
CREATE TABLE "benefits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "category" "BenefitCategory" NOT NULL,
    "partner_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "contact" TEXT,
    "logo_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "benefits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "benefits_tenant_id_active_category_sort_order_idx" ON "benefits"("tenant_id", "active", "category", "sort_order");

-- AddForeignKey
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Grant minimo para conecta_app (mesmo padrao de inc007_notifications).
-- SELECT/INSERT/UPDATE/DELETE: o admin cria, edita, ativa/desativa e pode
-- remover (confirmacao destrutiva, padrao INC-012.5). Beneficio e' conteudo de
-- marketing do tenant, nao registro juridico/append-only como acks — hard
-- delete e' aceitavel, por isso DELETE entra no grant (ao contrario de
-- announcement_acks/audit_logs).
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON benefits TO conecta_app;

-- ---------------------------------------------------------------------------
-- Row-Level Security por tenant_id (ADR-003).
-- ---------------------------------------------------------------------------
ALTER TABLE benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefits FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON benefits
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
