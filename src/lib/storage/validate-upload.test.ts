import { describe, expect, it } from "vitest";
import type { MediaStorage } from "./media-storage";
import { MAX_MEDIA_UPLOAD_BYTES, MAX_PDF_UPLOAD_BYTES } from "./media-constraints";
import { validateUploadedObject } from "./validate-upload";

// Storage fake em memoria: exercita SO' o contrato que validateUploadedObject
// usa (readHead + delete), sem tocar disco. `readHead` devolve o cabeçalho + o
// tamanho total, como o mock local e o R2 (GetObject com Range).
function fakeStorage(objects: Map<string, Buffer>): MediaStorage {
  return {
    getUploadUrl: async () => "unused",
    getViewUrl: async () => "unused",
    async readHead(key, maxBytes) {
      const buf = objects.get(key);
      if (!buf) return null;
      return { bytes: buf.subarray(0, maxBytes), totalSize: buf.length };
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF_HEADER = Buffer.from("%PDF-1.7\n");
const EXE_HEADER = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);

function pngOf(bytes: number): Buffer {
  return Buffer.concat([PNG_HEADER, Buffer.alloc(Math.max(0, bytes - PNG_HEADER.length))]);
}
function pdfOf(bytes: number): Buffer {
  return Buffer.concat([PDF_HEADER, Buffer.alloc(Math.max(0, bytes - PDF_HEADER.length))]);
}

describe("validateUploadedObject — autoridade pos-upload (INC-016)", () => {
  it("aceita imagem valida dentro do limite e devolve tipo REAL + tamanho", async () => {
    const objects = new Map([["k", pngOf(1000)]]);
    const result = await validateUploadedObject(fakeStorage(objects), "k");
    expect(result).toEqual({ ok: true, kind: "image", contentType: "image/png", sizeBytes: 1000 });
    expect(objects.has("k")).toBe(true); // valido permanece
  });

  it("aceita PDF de 8MB (abaixo do teto de 10MB)", async () => {
    const objects = new Map([["k", pdfOf(8 * 1024 * 1024)]]);
    const result = await validateUploadedObject(fakeStorage(objects), "k");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.contentType).toBe("application/pdf");
  });

  it("rejeita executavel disfarcado de .pdf e APAGA o objeto", async () => {
    const objects = new Map([["k", EXE_HEADER]]);
    const result = await validateUploadedObject(fakeStorage(objects), "k");
    expect(result).toEqual({ ok: false, reason: "type" });
    expect(objects.has("k")).toBe(false); // invalido foi removido do storage
  });

  it("rejeita imagem acima de 5MB e apaga", async () => {
    const objects = new Map([["k", pngOf(MAX_MEDIA_UPLOAD_BYTES + 1)]]);
    const result = await validateUploadedObject(fakeStorage(objects), "k");
    expect(result).toEqual({ ok: false, reason: "size" });
    expect(objects.has("k")).toBe(false);
  });

  it("rejeita PDF acima de 10MB e apaga", async () => {
    const objects = new Map([["k", pdfOf(MAX_PDF_UPLOAD_BYTES + 1)]]);
    const result = await validateUploadedObject(fakeStorage(objects), "k");
    expect(result).toEqual({ ok: false, reason: "size" });
    expect(objects.has("k")).toBe(false);
  });

  it("rejeita objeto vazio como tipo invalido", async () => {
    const objects = new Map([["k", Buffer.alloc(0)]]);
    const result = await validateUploadedObject(fakeStorage(objects), "k");
    expect(result).toEqual({ ok: false, reason: "type" });
  });

  it("objeto inexistente -> not_found (nada a apagar)", async () => {
    const result = await validateUploadedObject(fakeStorage(new Map()), "sumiu");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});
