# Runbook — Teste de restore de backup em ambiente limpo (INC-013 G3)

> **Critério de aceite do INC-013:** "Restore de backup executado com sucesso em
> ambiente limpo (log no vault)." Este documento é **as duas coisas ao mesmo
> tempo**: o roteiro a seguir **e** o template de evidência a preencher. Ao
> terminar, a cópia preenchida (com prints e saídas de query) é a evidência no
> vault. Duplique este arquivo como `runbook-teste-de-restore-YYYY-MM-DD.md` ao
> executar, ou preencha as seções [EVIDÊNCIA] abaixo e faça commit.

## O que este teste prova (e por que cada parte importa)

Um backup só vale se você já provou que **restaura**. O teste demonstra, num
ambiente **isolado da produção**, que a partir do backup você recupera:

1. **Os dados** — todas as tabelas, contagens batendo com a produção no momento do backup.
2. **A integridade referencial** — nenhum órfão (ack sem user, user sem tenant, etc.).
3. **A camada de segurança** — RLS por `tenant_id` ativa (`FORCE`), triggers de
   imutabilidade de `announcement_acks`/`announcement_versions`/`audit_logs`, e a
   coluna gerada `search_vector` — tudo isso é **schema**, então viaja com o banco;
   o teste confirma que sobreviveu, não que "deveria".
4. **A aplicação de fato sobe e opera** contra o banco restaurado (login por CPF,
   comunicados, acks, auditoria) — a prova funcional que fecha o critério.

Também mede **RTO** (quanto tempo levou pra recuperar) e **RPO** (quanto de dado
se perderia), que é o que o runbook de go-live vai citar.

## Pré-requisitos (verificações manuais do Pedro — fora do código)

- [ ] **M2 — Backups automáticos ativos e cifrados** no painel do Neon (é o que
      você está confirmando agora). Anotar: retenção de histórico/PITR disponível
      (ex.: 7 dias), e que o storage é cifrado em repouso.
- [ ] **M1 — HTTPS forçado** no domínio de produção (não é pré-requisito do
      restore em si, mas registra junto no bloco de operação).
- [ ] **M3 — Região da infra** (Neon) anotada — alimenta a declaração de
      transferência internacional do G2 e contextualiza onde o backup vive.
- [ ] Ferramentas locais: `psql`, `pg_dump`/`pg_restore` (client do Postgres 16),
      Docker (para o Caminho B), Node/npm do projeto.

> **Regra de ouro:** o teste **valida o estado restaurado, não o modifica**. Nunca
> rode `prisma migrate` nem `prisma db seed` contra o banco restaurado — isso
> mascararia um backup incompleto. O único "seed" permitido é definir a **senha**
> da role `conecta_app` (não altera dados), e só no Caminho B.

---

## Passo 0 — Linha de base da produção (a régua de comparação)

Antes (ou no momento) do backup que você vai restaurar, capture a régua. Conecte
no banco de **produção** (read-only basta) e rode o **bloco de contagens** (abaixo,
Passo 3.A). Salve a saída — é o "esperado". Anote também o **ponto no tempo** do
backup (timestamp/LSN) que você vai restaurar.

`[EVIDÊNCIA]` Cole aqui a tabela de contagens da produção + timestamp do backup:

```
(colar saída do bloco de contagens rodado na produção)
Backup point-in-time: __________________  (UTC)
```

---

## Caminho A — Restore nativo do Neon (branch/PITR)  ← recomendado

É o que testa **o backup real do Neon** e preserva roles + RLS + triggers sem
setup manual (um branch do Neon é um clone do estado do Postgres, incluindo a role
`conecta_app` e sua senha).

1. **Criar o branch de restore.** Neon Console → projeto → **Branches** →
   *Create branch* → **from a point in time** e escolha o instante a provar (ex.:
   a madrugada anterior; ou o ponto **mais antigo** da retenção, para provar a
   janela inteira do PITR). Nomeie `restore-test-YYYYMMDD`.
   - `[EVIDÊNCIA]` print da tela de criação mostrando o timestamp/LSN escolhido.
2. **Pegar as connection strings do branch.** O branch tem um endpoint próprio
   (host diferente), mesmo nome de banco e mesmas roles. Copie a string da role
   **owner** e da role **`conecta_app`** (senha da app é a mesma da produção).
3. **Apontar uma instância limpa da app para o branch.** Local (recomendado) ou
   staging. Nada de migrate/seed. Em modo produção local, lembre do
   `AUTH_TRUST_HOST` (ver `infra-banco-dev-e-ci.md`):
   ```bash
   # .env.restore-test (NÃO commitar) — aponta para o BRANCH do Neon
   DATABASE_URL="postgresql://<owner>:<senha>@<host-do-branch>/<db>?sslmode=require"
   APP_DATABASE_URL="postgresql://conecta_app:<APP_DB_PASSWORD>@<host-do-branch>/<db>?sslmode=require"
   CPF_HASH_PEPPER="<mesmo pepper da produção>"   # senão o login por CPF não casa
   AUTH_SECRET="<mesmo AUTH_SECRET da produção>"  # senão sessões/tokens de mídia não batem
   AUTH_TRUST_HOST=true
   # (marque o início do cronômetro de RTO aqui)
   npm run build
   npx dotenv -e .env.restore-test -- npm start   # ou exporte as vars e rode `npm start`
   ```
   > `CPF_HASH_PEPPER` e `AUTH_SECRET` **não** vivem no banco — são env. Para o
   > login e a validação funcional baterem, use os mesmos valores da produção.
4. **Validar** — rode a Seção "Validação" inteira apontando `psql` para o branch.
5. **Prova funcional** — Seção "Prova funcional pela aplicação".
6. **Cronometrar** — pare o RTO quando a app estiver servindo dados restaurados e
   a validação passar. Anote.
7. **Teardown** — Neon Console → delete o branch `restore-test-YYYYMMDD` (evita
   custo de compute e uma cópia extra de PII parada). `[EVIDÊNCIA]` print/confirmação.

---

## Caminho B — Dump lógico → Postgres novo e vazio  (opcional; DR/portabilidade)

Prova mais forte de "ambiente limpo": recupera num Postgres **totalmente novo**,
provando que você não depende do Neon estar de pé. Faça quando quiser demonstrar
independência de fornecedor; o Caminho A já satisfaz o critério de aceite.

**Gotcha importante (roles):** um `pg_dump` de banco inclui tabelas, dados,
policies RLS, triggers, coluna gerada e GRANTs — **mas não as roles** (são
cluster-global). Como as policies dão `GRANT ... TO conecta_app`, a role precisa
**existir antes** do restore.

1. **Dump** (de preferência a partir do **branch** do Caminho A, para não pesar na
   produção):
   ```bash
   pg_dump "$SOURCE_URL_OWNER" -Fc --no-owner -f conecta-backup.dump
   ```
2. **Postgres novo e isolado** (não reutilize o volume de dev `conecta_pgdata`):
   ```bash
   docker run --rm -d --name conecta-restore \
     -e POSTGRES_USER=conecta -e POSTGRES_PASSWORD=owner_pw -e POSTGRES_DB=conecta_restore \
     -p 5433:5432 postgres:16
   ```
3. **Criar a role `conecta_app` antes do restore** (o dump não a traz):
   ```bash
   psql "postgresql://conecta:owner_pw@localhost:5433/conecta_restore" \
     -c "CREATE ROLE conecta_app LOGIN PASSWORD '<APP_DB_PASSWORD>';"
   ```
4. **Restore:**
   ```bash
   pg_restore --no-owner -d "postgresql://conecta:owner_pw@localhost:5433/conecta_restore" conecta-backup.dump
   ```
   Avisos de "role ... does not exist" **não devem aparecer** para `conecta_app`
   (criada no passo 3). Qualquer erro de GRANT/policy é falha do teste — investigue.
5. **Apontar a app** para `localhost:5433` (owner + `conecta_app`) e validar como no
   Caminho A.
6. **Teardown:** `docker rm -f conecta-restore` + `rm conecta-backup.dump` (o dump e
   o container têm PII — não deixe parados).

---

## Validação (rodar contra o banco RESTAURADO)

### A. Contagens vs. linha de base (Passo 0)

```sql
SELECT 'tenants' AS tabela, count(*) AS n FROM tenants
UNION ALL SELECT 'branches', count(*) FROM branches
UNION ALL SELECT 'users', count(*) FROM users
UNION ALL SELECT 'announcements', count(*) FROM announcements
UNION ALL SELECT 'announcement_versions', count(*) FROM announcement_versions
UNION ALL SELECT 'announcement_acks', count(*) FROM announcement_acks
UNION ALL SELECT 'announcement_reads', count(*) FROM announcement_reads
UNION ALL SELECT 'posts', count(*) FROM posts
UNION ALL SELECT 'job_openings', count(*) FROM job_openings
UNION ALL SELECT 'job_applications', count(*) FROM job_applications
UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs
UNION ALL SELECT 'sessions', count(*) FROM sessions
ORDER BY tabela;
```
✅ Esperado: cada contagem **igual** à linha de base da produção (sessões podem
diferir se expiraram entre o backup e a leitura — aceitável; as demais devem bater).

### B. Integridade referencial (todos devem dar **0**)

```sql
SELECT 'ack_sem_user'       AS checagem, count(*) AS orfaos FROM announcement_acks a LEFT JOIN users u ON u.id = a.user_id WHERE u.id IS NULL
UNION ALL SELECT 'ack_sem_versao',      count(*) FROM announcement_acks a LEFT JOIN announcement_versions v ON v.id = a.version_id WHERE v.id IS NULL
UNION ALL SELECT 'ack_sem_comunicado',  count(*) FROM announcement_acks a LEFT JOIN announcements an ON an.id = a.announcement_id WHERE an.id IS NULL
UNION ALL SELECT 'read_sem_user',       count(*) FROM announcement_reads r LEFT JOIN users u ON u.id = r.user_id WHERE u.id IS NULL
UNION ALL SELECT 'user_sem_tenant',     count(*) FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id WHERE t.id IS NULL
UNION ALL SELECT 'user_sem_branch',     count(*) FROM users u LEFT JOIN branches b ON b.id = u.branch_id WHERE b.id IS NULL;
```
✅ Esperado: `orfaos = 0` em todas as linhas.

### C. Versão do schema

```bash
# Aponta para o banco restaurado (owner). NÃO aplica nada — só lê o histórico.
npx prisma migrate status
```
✅ Esperado: "Database schema is up to date!" e **todas** as migrations aplicadas
(hoje **11**, terminando em `..._inc013_g1_retention_and_deactivated_at`).

### D. Camada de segurança sobreviveu

**RLS ativa + forçada:**
```sql
SELECT relname, relrowsecurity AS rls, relforcerowsecurity AS forcado
FROM pg_class
WHERE relname IN ('users','announcement_acks','announcements','sessions','audit_logs','notifications')
ORDER BY relname;
```
✅ Esperado: `rls = t` e `forcado = t` em todas.

**Triggers de imutabilidade presentes:**
```sql
SELECT tgrelid::regclass AS tabela, tgname
FROM pg_trigger
WHERE NOT tgisinternal AND (tgname LIKE '%no_update_delete%' OR tgname LIKE '%no_truncate%')
ORDER BY 1, 2;
```
✅ Esperado: entradas para `announcement_acks`, `announcement_versions` e `audit_logs`.

**Coluna gerada + índice full-text + busca funcionando:**
```sql
SELECT is_generated, generation_expression
FROM information_schema.columns
WHERE table_name = 'announcement_versions' AND column_name = 'search_vector';
-- is_generated = ALWAYS

SELECT indexname FROM pg_indexes
WHERE tablename = 'announcement_versions' AND indexdef ILIKE '%gin%';
-- deve listar o índice GIN do search_vector

SELECT count(*) FROM announcement_versions WHERE search_vector @@ plainto_tsquery('portuguese', 'comunicado');
-- >= 0 sem erro (a coluna gerada respondeu à busca)
```

### E. Isolamento e imutabilidade na prática

**RLS de verdade** — conectado como **`conecta_app`** (`APP_DATABASE_URL`):
```sql
-- SEM tenant no contexto: a RLS bloqueia tudo
SELECT count(*) FROM users;                                  -- esperado: 0

-- COM um tenant real setado (pegue um id de `SELECT id FROM tenants LIMIT 1` como owner):
SELECT set_config('app.tenant_id', '<TENANT_ID>', false);
SELECT count(*) FROM users;                                  -- esperado: nº de users daquele tenant
```

**Imutabilidade** — conectado como **owner** (para o trigger disparar, não a falta de GRANT):
```sql
-- deve FALHAR com 'announcement_acks e imutavel: UPDATE nao e permitido'
UPDATE announcement_acks SET content_hash_at_ack = 'adulterado'
WHERE id = (SELECT id FROM announcement_acks LIMIT 1);
```
✅ Esperado: erro do trigger (a transação aborta). Se o UPDATE **passar**, o backup
restaurou dados mas perdeu a proteção → **falha do teste**.

### Prova funcional pela aplicação

Com a app apontada para o banco restaurado:
- [ ] **Login por CPF** de um colaborador conhecido (CPF + senha) → entra. Prova
      que `cpf_hash`+pepper, hash de senha e o caminho de login sob RLS sobreviveram.
- [ ] **Comunicados** listam; um `requires_ack` mostra o estado de ciência/pendência coerente.
- [ ] **Confirmação (ack)** de um usuário conhecido aparece no histórico esperado.
- [ ] **/admin/auditoria** mostra os logs (inclui eventos pré-backup).
- [ ] Um registro específico conferido ponta a ponta (ex.: o comunicado nº X e sua
      lista de acks batem com o que você sabia da produção).

---

## RTO / RPO medidos

- **RPO (perda máxima de dados):** definido pela granularidade do backup/PITR do
  Neon. Com PITR contínuo dentro da retenção, RPO ≈ segundos–minutos. Anote o valor
  e a **janela de retenção** (ex.: 7 dias) — fora da janela, não há restore.
- **RTO (tempo de recuperação):** cronômetro do Passo 3 do Caminho A até a app
  servir dados restaurados com a validação verde.

`[EVIDÊNCIA]`
```
RPO: __________   (janela de retenção: __________)
RTO: __________   (branch criado __:__  →  app validada __:__)
```

---

## Resultado — checklist de aceite (preencher)

- [ ] A. Contagens batem com a linha de base.
- [ ] B. Integridade referencial: 0 órfãos.
- [ ] C. `migrate status` limpo, 11 migrations.
- [ ] D. RLS forçada + triggers de imutabilidade + `search_vector` presentes.
- [ ] E. Isolamento por tenant e imutabilidade do ack comprovados na prática.
- [ ] Prova funcional: login + comunicados + ack + auditoria OK.
- [ ] RTO/RPO anotados.
- [ ] Teardown feito (branch/container/dump destruídos — sem PII parada).

**Veredito:** ⬜ PASSOU ⬜ FALHOU  
**Executado por:** __________ **Data (UTC):** __________  
**Método:** ⬜ Caminho A (Neon branch) ⬜ Caminho B (dump lógico)  
**Observações / anomalias:** __________

`[EVIDÊNCIA]` Anexar prints (criação do branch com timestamp, login na app,
/admin/auditoria) e as saídas das queries A–E.

---

## Cadência recomendada

- **Antes do go-live do piloto** (bloqueia o go-live enquanto não passar uma vez).
- **Depois de qualquer migration que mexa em estrutura** (novo modelo, nova RLS/trigger).
- **Trimestral** durante o piloto, como rotina — um restore que nunca foi testado
  não é um backup, é uma esperança.

> Relacionado: pré-requisitos M1/M2/M3 e o item G3 em
> `docs/04-Roadmap/incrementos/INC-013-hardening-piloto.md` (Bloco D). Roles/RLS/
> ambientes em `docs/02-Arquitetura/infra-banco-dev-e-ci.md`.
