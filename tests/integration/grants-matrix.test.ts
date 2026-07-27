import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Detector de drift da matriz de GRANTs da role de runtime `conecta_app`
 * (auditoria de permissoes 2026-07-27).
 *
 * Por que existe: o privilegio minimo aqui e' PROPOSITAL — conecta_app so' tem o
 * verbo que cada feature realmente escreve, e nao ha' ALTER DEFAULT PRIVILEGES
 * (pg_default_acl vazio de proposito: default privileges dariam verbos
 * automaticamente a tabelas futuras, o oposto do que queremos). O custo disso e'
 * que toda tabela nova nasce SEM nenhum GRANT, e ate' aqui nada acusava a
 * divergencia — dois bugs identicos escaparam para producao por esse buraco:
 *   1. INC-017: faltava GRANT UPDATE em tenants (tela "Aparencia da empresa").
 *   2. 2026-07-27: faltava GRANT DELETE em branches ("Remover filial").
 * O furo nunca foi a lista de GRANTs (estava 19/20 exata, zero verbo sobrando) —
 * foi a ausencia de quem percebesse a divergencia. Este teste e' esse detector.
 *
 * Falha nas TRES direcoes:
 *   1. GRANT faltando — a app escreve e a role nao pode (o bug dos dois casos acima).
 *   2. GRANT sobrando — verbo concedido sem chamador (erosao do privilegio minimo).
 *   3. Tabela fora da matriz — tabela nova em `public` ausente do EXPECTED, o que
 *      forca a decisao consciente de GRANT em todo INC que cria tabela.
 *
 * MANTER EM DIA: toda migration que cria tabela, ou toda feature que passa a
 * escrever num verbo novo, atualiza o EXPECTED abaixo na MESMA branch. O item 3
 * garante que esquecer quebra o CI, nao a producao.
 */

type Verb = "SELECT" | "INSERT" | "UPDATE" | "DELETE";
const VERBS: Verb[] = ["SELECT", "INSERT", "UPDATE", "DELETE"];

/**
 * Verbos que a aplicacao REALMENTE exige, levantados do codigo de runtime
 * (src/lib/repositories/* + o INSERT ... ON CONFLICT cru de
 * announcement-sequence.repository.ts). prisma/seed*.ts e os testes rodam como
 * role owner e nao entram nesta conta.
 */
const EXPECTED: Record<string, Verb[]> = {
  announcements: ["SELECT", "INSERT", "UPDATE"],
  announcement_versions: ["SELECT", "INSERT"], // imutavel (regra 6): sem UPDATE/DELETE
  announcement_audiences: ["SELECT", "INSERT", "DELETE"],
  announcement_acks: ["SELECT", "INSERT"], // imutavel (regra 6): sem UPDATE/DELETE, jamais
  announcement_reads: ["SELECT", "INSERT"],
  announcement_sequences: ["SELECT", "INSERT", "UPDATE"], // upsert da numeracao de CI
  audit_logs: ["SELECT", "INSERT"], // imutavel: sem UPDATE/DELETE
  benefits: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  branches: ["SELECT", "INSERT", "UPDATE", "DELETE"], // DELETE: remover filial vazia
  job_openings: ["SELECT", "INSERT", "UPDATE"],
  job_applications: ["SELECT", "INSERT", "DELETE"],
  notifications: ["SELECT", "INSERT", "UPDATE"],
  posts: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  post_media: ["SELECT", "INSERT", "DELETE"],
  post_people: ["SELECT", "INSERT", "DELETE"],
  post_reactions: ["SELECT", "INSERT", "DELETE"],
  push_subscriptions: ["SELECT", "INSERT", "DELETE"],
  sessions: ["SELECT", "INSERT", "UPDATE"], // revogacao e' UPDATE (revoked_at), nao DELETE
  tenants: ["SELECT", "UPDATE"], // a app edita aparencia; nunca cria/apaga tenant
  users: ["SELECT", "INSERT", "UPDATE"], // anonimizacao e' UPDATE, nao DELETE
  // Tabela de controle do Prisma: exclusiva da role owner (`prisma migrate
  // deploy`). Lista vazia de proposito — assim o teste tambem AFIRMA que a app
  // nao alcanca a tabela de migrations, em vez de trata-la como excecao.
  _prisma_migrations: [],
};

const APP_ROLE = "conecta_app";

// Role owner (DATABASE_URL): has_table_privilege e' consultavel por qualquer
// role, mas usamos o owner por simetria com os outros testes de integracao.
const ownerDb = new PrismaClient();

afterAll(async () => {
  await ownerDb.$disconnect();
});

type PrivilegeRow = { table_name: string; verb: string; granted: boolean };

/** Matriz real: uma consulta so', todas as tabelas de `public` x todos os verbos. */
async function readActualMatrix(): Promise<Map<string, Set<Verb>>> {
  const rows = await ownerDb.$queryRaw<PrivilegeRow[]>`
    SELECT c.relname::text AS table_name,
           v.verb::text    AS verb,
           has_table_privilege(${APP_ROLE}, c.oid, v.verb) AS granted
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS v(verb)
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
  `;

  const matrix = new Map<string, Set<Verb>>();
  for (const row of rows) {
    if (!matrix.has(row.table_name)) matrix.set(row.table_name, new Set());
    if (row.granted) matrix.get(row.table_name)!.add(row.verb as Verb);
  }
  return matrix;
}

describe("matriz de GRANTs de conecta_app (detector de drift)", () => {
  it("nenhuma tabela de public esta' fora do EXPECTED", async () => {
    const actual = await readActualMatrix();
    const unknown = [...actual.keys()].filter((table) => !(table in EXPECTED)).sort();

    // Se isto falhar: uma migration criou tabela e ninguem decidiu os GRANTs
    // dela. Adicione a tabela ao EXPECTED com os verbos MINIMOS que a app
    // escreve (lista vazia se a app nao deve tocar) e conceda-os na migration.
    expect(unknown, `tabela(s) sem entrada no EXPECTED: ${unknown.join(", ")}`).toEqual([]);
  });

  it("nenhum GRANT faltando (a app escreve e a role pode)", async () => {
    const actual = await readActualMatrix();
    const missing: string[] = [];

    for (const [table, verbs] of Object.entries(EXPECTED)) {
      const held = actual.get(table);
      if (!held) continue; // tabela ausente do banco: coberto pelo teste de schema/migrations
      for (const verb of verbs) {
        if (!held.has(verb)) missing.push(`${table}.${verb}`);
      }
    }

    // Se isto falhar: feature em producao vai quebrar com 42501
    // ("permission denied"). Conceda o verbo exato numa migration manual
    // (ADR-008), nunca GRANT ALL.
    expect(missing, `GRANT faltando: ${missing.join(", ")}`).toEqual([]);
  });

  it("nenhum GRANT sobrando (privilegio minimo nao erodiu)", async () => {
    const actual = await readActualMatrix();
    const extra: string[] = [];

    for (const [table, verbs] of Object.entries(EXPECTED)) {
      const held = actual.get(table);
      if (!held) continue;
      const allowed = new Set(verbs);
      for (const verb of VERBS) {
        if (held.has(verb) && !allowed.has(verb)) extra.push(`${table}.${verb}`);
      }
    }

    // Se isto falhar: ou a app passou a precisar do verbo (documente no
    // EXPECTED, na mesma branch da feature) ou o GRANT foi concedido a mais e
    // deve ser revogado. Nao relaxe o EXPECTED sem chamador no codigo.
    expect(extra, `GRANT sobrando: ${extra.join(", ")}`).toEqual([]);
  });

  it("conecta_app nao pode dar TRUNCATE em nenhuma tabela", async () => {
    // TRUNCATE ignora RLS e os triggers de imutabilidade so' cobrem as tres
    // tabelas juridicas — a app nunca precisa deste verbo em nenhuma tabela.
    const rows = await ownerDb.$queryRaw<{ table_name: string }[]>`
      SELECT c.relname::text AS table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind = 'r'
         AND has_table_privilege(${APP_ROLE}, c.oid, 'TRUNCATE')
    `;
    expect(rows.map((r) => r.table_name)).toEqual([]);
  });
});
