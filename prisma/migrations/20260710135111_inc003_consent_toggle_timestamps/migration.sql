-- Nota INC-003: mesmo artefato de drift do Prisma com a coluna GENERATED
-- search_vector ja explicado na migration inc003_session_and_user_fields —
-- removido de novo aqui pelo mesmo motivo (nao derrubar a busca do INC-002).

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "birthday_visible_changed_at" TIMESTAMPTZ,
ADD COLUMN     "photo_visible_changed_at" TIMESTAMPTZ;
