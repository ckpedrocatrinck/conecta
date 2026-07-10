import { describe, expect, it } from "vitest";
import { generateProvisionalPassword } from "./provisional-password";

describe("generateProvisionalPassword", () => {
  it("gera senha de 10 caracteres sem caracteres ambiguos (0/O, 1/I/l)", () => {
    const password = generateProvisionalPassword();
    expect(password).toHaveLength(10);
    expect(password).not.toMatch(/[0O1Il]/);
  });

  it("gera valores diferentes a cada chamada", () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generateProvisionalPassword()));
    expect(passwords.size).toBe(20);
  });
});
