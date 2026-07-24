import { mkdir, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

// Raiz do mock de storage — fora de `public/`, nunca servido estaticamente
// pelo Next.js. So' acessivel via a rota /api/media/[key] (sessao + token
// assinado, ver media-storage.ts).
const ROOT = path.resolve(process.cwd(), ".local-media");

function resolveSafePath(key: string): string {
  const resolved = path.resolve(ROOT, key);
  if (!resolved.startsWith(ROOT + path.sep) && resolved !== ROOT) {
    throw new Error(`Chave de midia fora do diretorio permitido: "${key}"`);
  }
  return resolved;
}

export async function writeMediaFile(key: string, data: Buffer, contentType: string): Promise<void> {
  const filePath = resolveSafePath(key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
  await writeFile(`${filePath}.meta.json`, JSON.stringify({ contentType }));
}

export async function readMediaFile(key: string): Promise<{ data: Buffer; contentType: string } | null> {
  const filePath = resolveSafePath(key);
  try {
    const [data, metaRaw] = await Promise.all([readFile(filePath), readFile(`${filePath}.meta.json`, "utf-8")]);
    const meta = JSON.parse(metaRaw) as { contentType: string };
    return { data, contentType: meta.contentType };
  } catch {
    return null;
  }
}

/** Le SO' os primeiros `maxBytes` do objeto + o tamanho total, sem carregar o
 * arquivo inteiro (mesmo contrato do R2: GetObject com Range: bytes=0-N, cujo
 * Content-Range revela o tamanho total). Base do confirm de upload (INC-016):
 * sniff do magic number + checagem de tamanho real sem estourar memoria. */
export async function readMediaHead(
  key: string,
  maxBytes: number,
): Promise<{ bytes: Buffer; totalSize: number } | null> {
  const filePath = resolveSafePath(key);
  try {
    const { size } = await stat(filePath);
    const handle = await open(filePath, "r");
    try {
      const length = Math.min(maxBytes, size);
      const buffer = Buffer.alloc(length);
      if (length > 0) await handle.read(buffer, 0, length, 0);
      return { bytes: buffer, totalSize: size };
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }
}

/** Remove o objeto e seu meta. Idempotente (force: nao falha se ja' nao existe)
 * — o confirm apaga uploads invalidos e a exclusao de anexo apaga o valido. */
export async function deleteMediaFile(key: string): Promise<void> {
  const filePath = resolveSafePath(key);
  await Promise.all([rm(filePath, { force: true }), rm(`${filePath}.meta.json`, { force: true })]);
}
