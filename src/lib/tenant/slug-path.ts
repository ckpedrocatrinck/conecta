// Edge-safe: trabalho puramente de string, SEM banco e SEM node:crypto — pode
// ser importado pelo middleware.ts (Edge Runtime). A resolucao autoritativa do
// slug -> tenantId vive na camada Node (resolve-tenant.ts), nunca aqui. Ver
// ADR-010 §2 (corrigido) e ADR-007 (split Edge/Node).

// Formato de slug de tenant: minusculas, digitos e hifen; comeca e termina em
// alfanumerico. Exclui de imediato assets com ponto (favicon.ico, icon-192.png,
// manifest.webmanifest) e qualquer coisa que nao pareca um slug — sem tocar o
// banco.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

// Primeiros segmentos que NUNCA sao slug de tenant. `_next` ja e' descartado
// pelo formato (underscore), mas fica explicito. Mantidos em sincronia com o
// que o matcher do middleware e os PUBLIC_PATHS tratam como nao-tenant.
const RESERVED_SEGMENTS = new Set(["api", "_next"]);

export function isReservedSegment(segment: string): boolean {
  return RESERVED_SEGMENTS.has(segment.toLowerCase());
}

/**
 * Extrai o primeiro segmento do path como candidato a slug de tenant. Retorna
 * null para a raiz institucional ("/"), segmentos reservados (api, _next) e
 * qualquer coisa fora do formato de slug (ex.: assets estaticos com ponto).
 * Puro string — seguro no Edge. Um candidato valido AINDA pode nao existir no
 * banco: quem decide isso (e devolve 404 sem vazar) e' a camada Node.
 */
export function extractTenantSlug(pathname: string): string | null {
  const first = pathname.split("/").find(Boolean);
  if (!first) return null;
  const segment = first.toLowerCase();
  if (isReservedSegment(segment)) return null;
  if (!SLUG_RE.test(segment)) return null;
  return segment;
}
