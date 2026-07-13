-- INC-008: filial associada opcional em Post (null = geral, mesmo padrao de
-- job_openings.branch_id). posts/post_people/post_media/post_reactions ja
-- existem desde a migration `init` (INC-002, forward-modelagem completa de
-- modelo-de-dados.md) com GRANT/RLS proprios em `rls_and_triggers` — esta
-- migration so adiciona a coluna nova, nao recria tabela nem GRANT/RLS.
--
-- Gerada a mao (nao via `prisma migrate dev`), seguindo o procedimento do
-- ADR-008: o diff automatico do Prisma mexeria em
-- `announcement_versions.search_vector` (coluna GENERATED), que o Postgres
-- rejeita alterar como coluna comum.

ALTER TABLE "posts" ADD COLUMN "branch_id" UUID;

ALTER TABLE "posts" ADD CONSTRAINT "posts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
