-- INC-003 (ADR-007): sessions e' o ponteiro do JWT de sessao do Auth.js —
-- tabela de dominio como qualquer outra, mesmo padrao de grant minimo e RLS
-- por tenant_id da migration rls_and_triggers (INC-002).

-- ---------------------------------------------------------------------------
-- 1. Grant minimo para conecta_app
-- ---------------------------------------------------------------------------
-- SELECT/INSERT: criar sessao e checar validade a cada request.
-- UPDATE: revogar (revoked_at) no logout.
-- Sem DELETE: sessoes expiradas/revogadas viram historico auditavel, nao sao
-- removidas pela aplicacao (limpeza, se necessaria, e' operacao administrativa
-- futura, fora deste INC).
GRANT SELECT, INSERT, UPDATE ON sessions TO conecta_app;

-- ---------------------------------------------------------------------------
-- 2. Row-Level Security por tenant_id
-- ---------------------------------------------------------------------------
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON sessions
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
