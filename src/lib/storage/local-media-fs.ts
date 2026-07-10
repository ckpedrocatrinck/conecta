import { mkdir, readFile, writeFile } from "node:fs/promises";
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
