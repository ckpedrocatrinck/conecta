-- INC-002: segunda linha de defesa multi-tenant (ADR-003) + imutabilidade
-- estrutural de announcement_acks (ADR-001/LGPD) + busca full-text.
--
-- Por que uma role separada (conecta_app): a role usada por `prisma migrate`
-- (a mesma do POSTGRES_USER do docker-compose) e' superuser/owner das
-- tabelas, e superuser SEMPRE ignora Row-Level Security, mesmo com
-- FORCE ROW LEVEL SECURITY. Sem uma role de runtime separada e nao-superuser,
-- a RLS abaixo seria decorativa. `conecta_app` e' criada aqui sem senha (uma
-- migration versionada nunca deve conter segredo); o seed roda
-- `ALTER ROLE conecta_app PASSWORD ...` lendo de env antes de popular dados.

-- ---------------------------------------------------------------------------
-- 1. Role de runtime da aplicacao (idempotente)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'conecta_app') THEN
    CREATE ROLE conecta_app LOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO conecta_app;

-- tenants: sem tenant_id (e' a raiz), sem RLS por tenant. So' leitura em
-- runtime (provisionamento de tenant e' operacao administrativa, fora do
-- escopo deste INC).
GRANT SELECT ON tenants TO conecta_app;

-- Grants por tabela, minimo necessario (nunca GRANT ALL). Tabelas
-- append-only (audit_logs, announcement_versions, announcement_reads,
-- announcement_acks) recebem so SELECT + INSERT.
GRANT SELECT, INSERT, UPDATE ON branches TO conecta_app;
GRANT SELECT, INSERT, UPDATE ON users TO conecta_app;
GRANT SELECT, INSERT, DELETE ON push_subscriptions TO conecta_app;
GRANT SELECT, INSERT ON audit_logs TO conecta_app;
GRANT SELECT, INSERT, UPDATE ON announcements TO conecta_app;
GRANT SELECT, INSERT ON announcement_versions TO conecta_app;
GRANT SELECT, INSERT, DELETE ON announcement_audiences TO conecta_app;
GRANT SELECT, INSERT ON announcement_reads TO conecta_app;
-- announcement_acks: SELECT/INSERT apenas — sem UPDATE/DELETE/TRUNCATE em
-- nenhuma circunstancia (garantia estrutural de imutabilidade, camada 1/3;
-- ver trigger na secao 3 e ausencia de metodo no repositorio TS).
GRANT SELECT, INSERT ON announcement_acks TO conecta_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON posts TO conecta_app;
GRANT SELECT, INSERT, DELETE ON post_people TO conecta_app;
GRANT SELECT, INSERT, DELETE ON post_media TO conecta_app;
GRANT SELECT, INSERT, DELETE ON post_reactions TO conecta_app;
GRANT SELECT, INSERT, UPDATE ON job_openings TO conecta_app;
GRANT SELECT, INSERT, DELETE ON job_applications TO conecta_app;

-- ---------------------------------------------------------------------------
-- 2. Row-Level Security por tenant_id em toda tabela de dominio
-- ---------------------------------------------------------------------------
-- current_setting('app.tenant_id', true) retorna NULL se a sessao/transacao
-- nao configurou o contexto (o `true` = missing_ok) — NULL = tenant_id nunca
-- e' verdadeiro em comparacao, logo SEM contexto o acesso e' negado por
-- padrao (default-deny), nao liberado. WITH CHECK e' declarado explicitamente
-- (nao dependemos do Postgres reaplicar USING implicitamente em policies
-- FOR ALL) para tambem bloquear INSERT/UPDATE que tentem gravar tenant_id
-- de outro tenant.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'branches', 'users', 'push_subscriptions', 'audit_logs',
    'announcements', 'announcement_versions', 'announcement_audiences',
    'announcement_reads', 'announcement_acks',
    'posts', 'post_people', 'post_media', 'post_reactions',
    'job_openings', 'job_applications'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid)
         WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)',
      t
    );
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- 3. Imutabilidade estrutural de announcement_acks (ADR-001 / LGPD)
-- ---------------------------------------------------------------------------
-- TRUNCATE ignora RLS e triggers row-level por completo — por isso ha' um
-- trigger dedicado FOR EACH STATEMENT para BEFORE TRUNCATE, alem do trigger
-- row-level de UPDATE/DELETE. Funciona independente de role/GRANT futuro
-- (nao depende so' de "ninguem chamar o metodo" na camada de acesso).

CREATE OR REPLACE FUNCTION forbid_announcement_ack_mutation()
RETURNS trigger AS $fn$
BEGIN
  RAISE EXCEPTION 'announcement_acks e imutavel: % nao e permitido', TG_OP;
END;
$fn$ LANGUAGE plpgsql;

CREATE TRIGGER announcement_acks_no_update_delete
  BEFORE UPDATE OR DELETE ON announcement_acks
  FOR EACH ROW EXECUTE FUNCTION forbid_announcement_ack_mutation();

CREATE TRIGGER announcement_acks_no_truncate
  BEFORE TRUNCATE ON announcement_acks
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_announcement_ack_mutation();

-- ---------------------------------------------------------------------------
-- 4. Busca full-text em announcement_versions (indice critico do doc)
-- ---------------------------------------------------------------------------
-- Prisma nao modela coluna gerada; troca a coluna tsvector simples criada
-- pela migration `init` por uma coluna GENERATED ALWAYS AS ... STORED.

ALTER TABLE announcement_versions DROP COLUMN search_vector;

ALTER TABLE announcement_versions
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) STORED;

CREATE INDEX announcement_versions_search_vector_idx
  ON announcement_versions USING GIN (search_vector);
