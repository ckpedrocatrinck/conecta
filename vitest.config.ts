import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

// Testes de integracao (isolamento multi-tenant) precisam de DATABASE_URL /
// APP_DATABASE_URL do .env — vitest nao carrega .env em process.env por
// padrao (so' expoe prefixo VITE_ via import.meta.env), por isso o loadEnv
// explicito abaixo (prefixo "" = carrega tudo).
const env = loadEnv("", process.cwd(), "");

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
