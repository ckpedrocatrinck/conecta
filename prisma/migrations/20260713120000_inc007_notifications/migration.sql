-- INC-007: canal abstrato de notificacao (in-app agora, push no INC-012 sem
-- migracao nova — ver comentario do model Notification em schema.prisma).
--
-- Nota: gerado a mao (nao via `prisma migrate dev`) porque o diff automatico
-- do Prisma tenta mexer em `announcement_versions.search_vector`, uma coluna
-- GENERATED ALWAYS que o schema.prisma deliberadamente nao modela (ver
-- comentario na migration rls_and_triggers) — o autogerado incluia
-- `ALTER COLUMN search_vector DROP DEFAULT`, que o Postgres rejeita para
-- coluna gerada. Esta migration so contem o que de fato muda.

-- ---------------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------------

CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "announcement_id" UUID,
    "channel" TEXT NOT NULL DEFAULT 'in_app',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_tenant_id_user_id_read_at_idx" ON "notifications"("tenant_id", "user_id", "read_at");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Grant minimo para conecta_app (mesmo padrao de sessions_rls_and_grants)
-- ---------------------------------------------------------------------------
-- SELECT/INSERT: criar e listar notificacoes. UPDATE: marcar read_at ao abrir.
-- Sem DELETE: notificacao lida vira historico, nao e removida pela aplicacao.
GRANT SELECT, INSERT, UPDATE ON notifications TO conecta_app;

-- ---------------------------------------------------------------------------
-- 3. Row-Level Security por tenant_id
-- ---------------------------------------------------------------------------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON notifications
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
