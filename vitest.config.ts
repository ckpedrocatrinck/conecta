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

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    env,
  },
});
