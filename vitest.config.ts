import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

// Testes de integracao (isolamento multi-tenant) precisam de DATABASE_URL /
// APP_DATABASE_URL — vitest nao carrega .env em process.env por padrao (so'
// expoe prefixo VITE_ via import.meta.env), por isso o loadEnv explicito
// abaixo (prefixo "" = carrega tudo, para uso local via arquivo .env). Na
// CI as env vars vem direto do job (sem arquivo .env) — process.env sempre
// tem prioridade sobre o que vier de arquivo.
const fileEnv = loadEnv("", process.cwd(), "");
const processEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);
const env = { ...fileEnv, ...processEnv };

// `test.env` (abaixo) só é injetada nos workers que rodam os arquivos de
// teste — o `globalSetup` roda antes disso, no processo principal do
// Vitest, e lê `process.env` diretamente (ver ensureAppRolePassword em
// prisma/db-admin.ts). Sem isto, um `.env` só de arquivo (sem as vars já
// exportadas no shell) nunca chega ao globalSetup, e ele falha com
// "APP_DB_PASSWORD nao configurada" mesmo com o .env preenchido.
for (const [key, value] of Object.entries(fileEnv)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    env,
    globalSetup: "./tests/global-setup.ts",
  },
});
