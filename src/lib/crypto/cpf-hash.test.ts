import { describe, expect, it } from "vitest";
import { hashCpf, normalizeCpf } from "./cpf-hash";

describe("normalizeCpf", () => {
  it("mantem so os digitos", () => {
    expect(normalizeCpf("123.456.789-01")).toBe("12345678901");
  });
});

describe("hashCpf", () => {
  const pepper = "test-pepper";

  it("e deterministico para o mesmo CPF e pepper", () => {
    expect(hashCpf("123.456.789-01", pepper)).toBe(hashCpf("12345678901", pepper));
  });

  it("normaliza formatacao antes de gerar o hash", () => {
    const withMask = hashCpf("123.456.789-01", pepper);
    const withoutMask = hashCpf("12345678901", pepper);
    expect(withMask).toBe(withoutMask);
  });

  it("gera hashes diferentes para CPFs diferentes", () => {
    expect(hashCpf("12345678901", pepper)).not.toBe(hashCpf("10987654321", pepper));
  });

  it("gera hashes diferentes para o mesmo CPF com pepper diferente", () => {
    expect(hashCpf("12345678901", pepper)).not.toBe(hashCpf("12345678901", "outro-pepper"));
  });

  it("falha sem pepper configurado", () => {
    const original = process.env.CPF_HASH_PEPPER;
    delete process.env.CPF_HASH_PEPPER;
    expect(() => hashCpf("12345678901", undefined)).toThrow(/pepper/i);
    process.env.CPF_HASH_PEPPER = original;
  });

  it("retorna hex de 64 caracteres (sha256)", () => {
    expect(hashCpf("12345678901", pepper)).toMatch(/^[0-9a-f]{64}$/);
  });
});
