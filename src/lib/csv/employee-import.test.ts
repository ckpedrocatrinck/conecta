import { describe, expect, it } from "vitest";
import { CSV_TEMPLATE_HEADER, parseEmployeeCsv, validateEmployeeCsvRow } from "./employee-import";

describe("parseEmployeeCsv", () => {
  it("numera as linhas a partir da 2 (linha 1 = cabecalho)", () => {
    const csv = `${CSV_TEMPLATE_HEADER}\nAna,MAT-1,12345678901,F1,employee,,,,\nBeto,MAT-2,10987654321,F1,manager,,,,`;
    const rows = parseEmployeeCsv(csv);
    expect(rows.map((r) => r.line)).toEqual([2, 3]);
    expect(rows[0].raw.nome).toBe("Ana");
  });

  it("ignora linhas vazias", () => {
    const csv = `${CSV_TEMPLATE_HEADER}\nAna,MAT-1,12345678901,F1,employee,,,,\n\n`;
    const rows = parseEmployeeCsv(csv);
    expect(rows).toHaveLength(1);
  });
});

describe("validateEmployeeCsvRow", () => {
  const validRaw = {
    nome: "Ana Silva",
    matricula: "MAT-1",
    cpf: "123.456.789-01",
    filial: "F1",
    papel: "employee",
    data_nascimento: "",
    data_contratacao: "",
    telefone: "",
    email: "",
  };

  it("aceita uma linha valida", () => {
    const result = validateEmployeeCsvRow(validRaw);
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.fullName).toBe("Ana Silva");
      expect(result.data.role).toBe("employee");
    }
  });

  it.each(["nome", "matricula", "cpf", "filial"])("rejeita quando falta %s", (field) => {
    const result = validateEmployeeCsvRow({ ...validRaw, [field]: "" });
    expect("error" in result).toBe(true);
  });

  it("rejeita papel invalido", () => {
    const result = validateEmployeeCsvRow({ ...validRaw, papel: "gerente-geral" });
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/papel inválido/);
  });
});
