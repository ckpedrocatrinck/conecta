import { afterEach, describe, expect, it } from "vitest";
import { mediaStorage } from "./media-storage";
import { readMediaFile, writeMediaFile } from "./local-media-fs";
import { validateUploadedObject } from "./validate-upload";

// O backend local (mock de dev) precisa honrar o contrato que o confirm usa:
// readHead devolve cabeçalho + tamanho total sem baixar o arquivo inteiro, e
// delete remove o objeto. Em prod o R2 implementa o mesmo contrato (Range GET /
// DeleteObject) — por isso o confirm nao muda ao virar a chave.
const KEY = "posts/test-tenant/test-post/local-fs-contract";

afterEach(async () => {
  await mediaStorage.delete(KEY);
});

describe("LocalMediaStorage — contrato readHead/delete (INC-016)", () => {
  it("readHead le so' o cabeçalho e reporta o tamanho total", async () => {
    const body = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(500)]);
    await writeMediaFile(KEY, body, "application/pdf");

    const head = await mediaStorage.readHead(KEY, 16);
    expect(head).not.toBeNull();
    expect(head!.totalSize).toBe(body.length);
    expect(head!.bytes.length).toBe(16);
    expect(head!.bytes.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("delete remove o objeto (readHead passa a devolver null) e e' idempotente", async () => {
    await writeMediaFile(KEY, Buffer.from("conteudo"), "text/plain");
    expect(await mediaStorage.readHead(KEY, 8)).not.toBeNull();

    await mediaStorage.delete(KEY);
    expect(await mediaStorage.readHead(KEY, 8)).toBeNull();
    expect(await readMediaFile(KEY)).toBeNull();
    // segunda remocao nao lanca
    await expect(mediaStorage.delete(KEY)).resolves.toBeUndefined();
  });

  it("readHead de chave inexistente -> null", async () => {
    expect(await mediaStorage.readHead("posts/x/y/inexistente", 16)).toBeNull();
  });
});

// Prova de seguranca de upload ponta-a-ponta (INC-016): o confirm real
// (validateUploadedObject sobre o mediaStorage de verdade) rejeita arquivo
// disfarçado E remove o objeto do disco — nao so' a logica isolada em memoria.
describe("arquivo disfarçado — ponta a ponta no storage real (INC-016)", () => {
  const DISGUISED = "posts/test-tenant/test-post/disfarcado-de-pdf";
  const VALID = "posts/test-tenant/test-post/pdf-valido-e2e";

  afterEach(async () => {
    await mediaStorage.delete(DISGUISED);
    await mediaStorage.delete(VALID);
  });

  it.each([
    ["executavel (MZ)", Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03])],
    ["ZIP (PK)", Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])],
    ["TXT", Buffer.from("nao sou um pdf, so' texto\n")],
  ])("%s salvo como .pdf e' rejeitado e APAGADO do disco", async (_label, bytes) => {
    // Simula o upload direto (bytes ja' no storage) com content-type mentido.
    await writeMediaFile(DISGUISED, bytes, "application/pdf");
    expect(await readMediaFile(DISGUISED)).not.toBeNull(); // esta' la' antes do confirm

    const result = await validateUploadedObject(mediaStorage, DISGUISED);

    expect(result).toEqual({ ok: false, reason: "type" });
    // O objeto REALMENTE sumiu do disco (nao ficou orfao).
    expect(await readMediaFile(DISGUISED)).toBeNull();
  });

  it("PDF de verdade passa e permanece no disco", async () => {
    await writeMediaFile(VALID, Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(200)]), "application/pdf");
    const result = await validateUploadedObject(mediaStorage, VALID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("document");
      expect(result.contentType).toBe("application/pdf");
    }
    expect(await readMediaFile(VALID)).not.toBeNull();
  });
});
