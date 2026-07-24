-- INC-016: anexos de post (imagem + PDF). Estende `post_media` para carregar
-- documento (PDF) ao lado de imagem e guardar metadados do arquivo
-- (kind/mime/nome/tamanho). A tabela, seus GRANT e a RLS (`tenant_isolation`)
-- ja existem desde `init`/`rls_and_triggers` (INC-002) — esta migration so'
-- adiciona o enum e as colunas novas; NAO recria tabela, GRANT nem policy
-- (RLS e' por linha, agnostica de coluna; o GRANT SELECT/INSERT/DELETE ja
-- cobre o insert de anexo — colunas novas sao preenchidas no INSERT, sem
-- necessidade de UPDATE).
--
-- Escrita a mao / aplicada com `prisma migrate deploy` (ADR-008): o diff
-- automatico do Prisma incluiria o ruido conhecido da coluna GENERATED
-- `announcement_versions.search_vector`, descartado aqui por nao ser mudanca
-- real.

-- CreateEnum
CREATE TYPE "PostMediaKind" AS ENUM ('image', 'document');

-- AlterTable. `kind` NOT NULL DEFAULT 'image' ja' faz o backfill das linhas
-- legadas (que sao todas fotos). Os demais metadados sao nulos no legado
-- (desconhecidos) e sempre preenchidos em uploads novos pelo confirm.
ALTER TABLE "post_media" ADD COLUMN "kind" "PostMediaKind" NOT NULL DEFAULT 'image';
ALTER TABLE "post_media" ADD COLUMN "mime_type" TEXT;
ALTER TABLE "post_media" ADD COLUMN "original_name" TEXT;
ALTER TABLE "post_media" ADD COLUMN "size_bytes" INTEGER;
