import { describe, expect, it } from "vitest";
import { sanitizeAnnouncementBody } from "./announcement-body";

describe("sanitizeAnnouncementBody", () => {
  it("preserva as tags permitidas (negrito, italico, listas, links)", () => {
    const input = '<p><strong>negrito</strong> <em>italico</em></p><ul><li>item</li></ul><a href="https://example.com">link</a>';
    expect(sanitizeAnnouncementBody(input)).toBe(input);
  });

  it("remove tags de script e atributos de evento", () => {
    const input = '<p onclick="alert(1)">texto</p><script>alert(1)</script>';
    const output = sanitizeAnnouncementBody(input);
    expect(output).not.toContain("<script");
    expect(output).not.toContain("onclick");
    expect(output).toContain("<p>texto</p>");
  });

  it("remove href com esquema javascript:", () => {
    const input = '<a href="javascript:alert(1)">clique</a>';
    const output = sanitizeAnnouncementBody(input);
    expect(output).not.toContain("javascript:");
  });

  it("mantem href http/https/mailto", () => {
    expect(sanitizeAnnouncementBody('<a href="https://example.com">x</a>')).toContain("https://example.com");
    expect(sanitizeAnnouncementBody('<a href="mailto:a@b.com">x</a>')).toContain("mailto:a@b.com");
  });

  it("descarta tags nao permitidas (tabela, imagem) mas mantem o texto interno", () => {
    const input = "<table><tr><td>celula</td></tr></table><img src=\"x.png\" />depois";
    const output = sanitizeAnnouncementBody(input);
    expect(output).not.toContain("<table");
    expect(output).not.toContain("<img");
    expect(output).toContain("celula");
    expect(output).toContain("depois");
  });
});
