import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password-hash";

describe("password-hash", () => {
  it("verifica a senha correta apos o hash", async () => {
    const hash = await hashPassword("Trocar123!");
    await expect(verifyPassword("Trocar123!", hash)).resolves.toBe(true);
  });

  it("rejeita senha incorreta", async () => {
    const hash = await hashPassword("Trocar123!");
    await expect(verifyPassword("outra-senha", hash)).resolves.toBe(false);
  });

  it("gera hashes diferentes para a mesma senha (salt aleatorio)", async () => {
    const [a, b] = await Promise.all([hashPassword("Trocar123!"), hashPassword("Trocar123!")]);
    expect(a).not.toBe(b);
  });
});
