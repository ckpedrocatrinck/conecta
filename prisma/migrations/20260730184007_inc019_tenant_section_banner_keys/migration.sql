-- INC-019 (Banner por secao): keys do banner de Vagas e Beneficios por tenant,
-- mesma natureza de home_banner_key (INC-017) — colunas fixas, nao tabela nova
-- (decisao: tenants nao tem RLS, UPDATE ja concedido no INC-017 cobre; nenhum
-- GRANT/RLS novo necessario).
-- Nulo => fallback: vagas cai no asset fixo public/banners/vagas.png; beneficios
-- cai no modo texto do HomeBanner (nao ha asset fixo proprio, fora de escopo).
-- ADR-008: passos indevidos sobre `search_vector` (DropIndex / DROP DEFAULT)
-- gerados pelo diff foram removidos a mao; so' resta a coluna nova.
ALTER TABLE "tenants" ADD COLUMN "vagas_banner_key" TEXT,
                      ADD COLUMN "beneficios_banner_key" TEXT;
