import { describe, expect, it } from "vitest";
import { sniffMediaType, SNIFF_HEADER_BYTES } from "./media-sniff";

// Assinaturas reais no inicio de cada tipo (magic number). O sniff olha SO' o
// cabeçalho — o resto do arquivo e' irrelevante para a deteccao.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x00, 0x00, 0x00, 0x00]), Buffer.from("WEBP")]);
const PDF = Buffer.from("%PDF-1.7\n");
// "MZ" — cabeçalho de executavel Windows (PE). Um arquivo assim renomeado para
// .pdf/.png NAO deve passar.
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
// "PK\x03\x04" — cabeçalho de ZIP. .zip renomeado para .pdf NAO deve passar.
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
// Texto puro (.txt renomeado para .pdf) — sem magic number reconhecivel.
const TXT = Buffer.from("apenas um texto qualquer, sem cabeçalho\n");

describe("sniffMediaType — tipo real por magic number (INC-016)", () => {
  it("reconhece JPEG, PNG, WEBP e PDF", () => {
    expect(sniffMediaType(JPEG)).toEqual({ kind: "image", contentType: "image/jpeg" });
    expect(sniffMediaType(PNG)).toEqual({ kind: "image", contentType: "image/png" });
    expect(sniffMediaType(WEBP)).toEqual({ kind: "image", contentType: "image/webp" });
    expect(sniffMediaType(PDF)).toEqual({ kind: "document", contentType: "application/pdf" });
  });

  it("rejeita executavel (MZ), ZIP (PK) e TXT mesmo que a extensao minta ser .pdf/.png", () => {
    expect(sniffMediaType(EXE)).toBeNull();
    expect(sniffMediaType(ZIP)).toBeNull();
    expect(sniffMediaType(TXT)).toBeNull();
  });

  it("rejeita conteudo irreconhecivel e cabeçalho vazio", () => {
    expect(sniffMediaType(Buffer.from("nao sou arquivo nenhum"))).toBeNull();
    expect(sniffMediaType(Buffer.alloc(0))).toBeNull();
  });

  it("RIFF sem 'WEBP' no offset 8 nao e' aceito (ex.: WAV/AVI)", () => {
    const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WAVE")]);
    expect(sniffMediaType(wav)).toBeNull();
  });

  it("16 bytes de cabeçalho bastam para distinguir WEBP (checa offset 8..11)", () => {
    expect(SNIFF_HEADER_BYTES).toBeGreaterThanOrEqual(12);
  });
});
