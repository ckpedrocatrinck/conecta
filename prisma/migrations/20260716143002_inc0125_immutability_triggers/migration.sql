-- INC-012.5 Bloco A (A4-1): fecha a assimetria de imutabilidade apontada na
-- auditoria de 2026-07 — announcement_versions e audit_logs tinham so' o
-- grant restrito (SELECT/INSERT), sem a 2a camada de defesa (trigger) que
-- announcement_acks ja tem desde a migration rls_and_triggers (INC-002).
-- Mesmo padrao exato dos triggers forbid_announcement_ack_mutation: uma
-- funcao dedicada por tabela, BEFORE UPDATE OR DELETE FOR EACH ROW +
-- BEFORE TRUNCATE FOR EACH STATEMENT.
--
-- Escrita a mao / aplicada com `prisma migrate deploy` (ADR-008) — nao ha'
-- mudanca de schema.prisma aqui, so' SQL de trigger; o diff gerado por
-- `migrate dev --create-only` (DROP INDEX / ALTER COLUMN DROP DEFAULT sobre
-- search_vector) foi descartado por ser o ruido conhecido da coluna
-- GENERATED, nao uma mudanca real.

CREATE OR REPLACE FUNCTION forbid_announcement_version_mutation()
RETURNS trigger AS $fn$
BEGIN
  RAISE EXCEPTION 'announcement_versions e imutavel: % nao e permitido', TG_OP;
END;
$fn$ LANGUAGE plpgsql;

CREATE TRIGGER announcement_versions_no_update_delete
  BEFORE UPDATE OR DELETE ON announcement_versions
  FOR EACH ROW EXECUTE FUNCTION forbid_announcement_version_mutation();

CREATE TRIGGER announcement_versions_no_truncate
  BEFORE TRUNCATE ON announcement_versions
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_announcement_version_mutation();

CREATE OR REPLACE FUNCTION forbid_audit_log_mutation()
RETURNS trigger AS $fn$
BEGIN
  RAISE EXCEPTION 'audit_logs e imutavel: % nao e permitido', TG_OP;
END;
$fn$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_mutation();

CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_audit_log_mutation();
