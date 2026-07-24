import { afterEach, describe, expect, it } from "vitest";
import { mediaStorage } from "./media-storage";
import { readMediaFile, writeMediaFile } from "./local-media-fs";

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
