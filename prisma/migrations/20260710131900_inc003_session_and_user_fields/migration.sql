-- Nota INC-003: o `prisma migrate dev` gerou aqui um DROP INDEX do indice
-- GIN de busca full-text (announcement_versions_search_vector_idx) e um
-- ALTER COLUMN ... DROP DEFAULT na coluna gerada search_vector — artefato de
-- drift do Prisma nao entender bem coluna GENERATED ALWAYS ... STORED e
-- indice criado via SQL raw (migration rls_and_triggers, nao declarado no
-- schema.prisma). Removido manualmente: aplicar isso derrubaria a busca de
-- comunicados do INC-002 sem necessidade (nada neste INC toca essa coluna).

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMPTZ,
ADD COLUMN     "photo_visible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "privacy_accepted_at" TIMESTAMPTZ,
ADD COLUMN     "privacy_notice_version" TEXT;

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_tenant_id_user_id_idx" ON "sessions"("tenant_id", "user_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
