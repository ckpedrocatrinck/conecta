import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { appDb } from "../../src/lib/db/app-client";
import { assertRuntimeAppRole } from "../../src/lib/db/assert-runtime-role";

// A4-3 (auditoria 2026-07): sem mock — contra os dois clients reais de teste
// (conecta_app via appDb, owner/superuser via DATABASE_URL) que ja existem
// no ambiente de CI/dev. instrumentation.ts nao dispara em `vitest run`
// (so' em next dev/build/start), por isso a checagem em si vive numa funcao
// separada, testavel direto.
const ownerDb = new PrismaClient();

describe("assertRuntimeAppRole", () => {
  it("resolve sem erro para o client real de runtime (conecta_app, nao-superuser)", async () => {
    await expect(assertRuntimeAppRole(appDb)).resolves.toBeUndefined();
  });

  it("rejeita para o client owner/superuser (o mesmo usado por prisma migrate/seed)", async () => {
    await expect(assertRuntimeAppRole(ownerDb)).rejects.toThrow(/nao-superuser/);
  });
});
