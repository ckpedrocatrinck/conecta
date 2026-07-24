-- INC-017 (Aparencia da empresa): key do banner da home por tenant.
-- Nulo => fallback para o asset fixo public/banners/home.png (home nunca quebra).
-- tenants nao tem RLS (raiz da hierarquia multi-tenant) — sem bloco GRANT/RLS.
-- ADR-008: passos indevidos sobre `search_vector` (DropIndex / DROP DEFAULT)
-- gerados pelo diff foram removidos a mao; so' resta a coluna nova.
ALTER TABLE "tenants" ADD COLUMN "home_banner_key" TEXT;
