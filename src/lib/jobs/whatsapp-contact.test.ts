import { describe, expect, it } from "vitest";
import { normalizeWhatsappNumber } from "./whatsapp-contact";

describe("normalizeWhatsappNumber — INC-021", () => {
  it("numero com mascara vira so' digitos com DDI 55 prefixado", () => {
    expect(normalizeWhatsappNumber("(22) 99999-9999")).toEqual({ waLink: "https://wa.me/5522999999999" });
  });

  it("numero que ja vem com 55 nao duplica o DDI", () => {
    expect(normalizeWhatsappNumber("55 22 99999-9999")).toEqual({ waLink: "https://wa.me/5522999999999" });
  });

  it("numero curto (menos de 10 digitos) sinaliza sem link", () => {
    expect(normalizeWhatsappNumber("9999-999")).toEqual({ waLink: null });
  });
});
