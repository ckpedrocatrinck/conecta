# Auditoria Completa — Projeto Conecta (INC-001 a INC-012)

- **Data:** 2026-07-16
- **Branch auditada:** `inc-012-pwa-push` (HEAD `46a0122`)
- **Natureza:** Revisão transversal de tudo que foi construído (INC-001 a 012), antecipando parte do INC-013 (hardening). **Não é um INC.**
- **Regra de execução:** auditoria **read-only** — nenhum arquivo de código foi modificado. As correções serão priorizadas e executadas depois, fora desta auditoria.
- **Método:** varredura por 7 domínios (segurança de tenant, auth/sessão, LGPD, núcleo jurídico, INC-012, doc↔código, qualidade/dívida), com verificação cruzada de arquivo/linha. Fonte de verdade: `docs/` (regra "docs vence").

## Resultados dos comandos automatizados

| Comando | Resultado |
|---|---|
| `npm run lint` | ✅ Passou, sem avisos |
| `npm run typecheck` (`tsc --noEmit`) | ✅ Passou, zero erros |
| `npm run test` (vitest integração) | ⚠️ **Não executou** — Postgres local (`localhost:5432` / Docker Desktop) indisponível no ambiente da auditoria; `tests/global-setup.ts` aborta em `ensureAppRolePassword` (`PrismaClientInitializationError: Can't reach database server`). Os testes **não foram exercidos**; a revisão do código de teste está no Domínio 7. Rodar localmente com `docker compose up -d` antes de confiar no verde. |
| `npm audit` | ⚠️ 2 vulnerabilidades **moderate** (`postcss <8.5.10`, XSS no stringify, puxado transitivamente por `next`). Sem fix não-breaking (o `audit fix --force` rebaixaria o Next). Detalhe no Domínio 7. |

---

## Sumário executivo

**Veredito geral:** a base é sólida e disciplinada. O isolamento multi-tenant (ADR-003), a autenticação com revogação em banco (ADR-007) e a imutabilidade do `AnnouncementAck` (regra 6) estão implementados com fidelidade e defesa em profundidade. **Nenhum achado CRÍTICO.** Nenhum caminho de vazamento entre tenants, nenhum segredo real no histórico git, nenhum CPF em claro. O maior volume de problemas está em (a) uma assimetria de imutabilidade, (b) um bug funcional real no disparo do cron, e (c) a documentação de roadmap/entrega defasada.

### Contagem por severidade

| Severidade | Qtde |
|---|---|
| 🔴 CRÍTICO | 0 |
| 🟠 ALTO | 4 |
| 🟡 MÉDIO | 14 |
| 🔵 BAIXO | 14 |

### Os 5 achados mais importantes

1. **🟠 ALTO — Cron de publicação agendada é bloqueado pelo middleware e nunca dispara** (A2-1). O matcher do `middleware.ts` só exclui `api/auth`; a chamada do cron (sem cookie de sessão) é redirecionada para `/login` antes do handler rodar. Comunicados agendados nunca auto-publicam em produção. Também conflita com a doc do INC-004 (esperava 401).
2. **🟠 ALTO — Imutabilidade assimétrica: `announcement_versions` e `audit_logs` sem trigger de bloqueio** (A4-1). O `announcement_acks` tem 3 camadas (grant + trigger UPDATE/DELETE + trigger TRUNCATE); as outras duas tabelas probatórias dependem só da ausência de grant — sem a 2ª linha de defesa contra migration futura descuidada ou TRUNCATE.
3. **🟠 ALTO — Anonimização de desligados (ADR-006) inexistente** (A3-1). `User.anonymizedAt` está no schema mas nada lê/escreve; sem rotina, sem prazo de retenção por tenant, sem preservação de ack pós-anonimização. Escopo do INC-013, mas **precisa entrar antes de dados reais em produção**.
4. **🟠 ALTO — INC-009/010/011 em produção sem Relatório de Entrega e sem marcação no roadmap** (A6-1). Viola a Regra Inviolável nº 4; o roadmap deixa de ser fonte-de-verdade do estado real.
5. **🟡 MÉDIO — Toda a defesa RLS/grant depende de `APP_DATABASE_URL` apontar para `conecta_app`, sem checagem** (A4-3). Um erro de env silencioso (apontar para a role owner/superuser) torna RLS e todos os grants restritivos decorativos de uma só vez, sem nada detectar.

---

# Achados por domínio

> Convenção de ID: `A<domínio>-<n>`. Domínios: 1 Tenant, 2 Auth/Sessão, 3 LGPD, 4 Núcleo Jurídico, 5 INC-012, 6 Doc↔Código, 7 Qualidade.

## Domínio 1 — Segurança de tenant

**Veredito: sólido.** Arquitetura de defesa em profundidade (ADR-003) aplicada uniformemente: role runtime não-superuser `conecta_app` + `withTenant` com `set_config('app.tenant_id', …, true)` escopado à transação + RLS `FORCE` com policy default-deny + filtro `tenantId` explícito na maioria das queries. **100% de cobertura RLS** nas 18 tabelas de domínio (`tenants` corretamente isenta, só SELECT). Nenhum endpoint aceita `tenant_id`/`userId` do cliente. Nenhuma query de runtime usa `appDb` fora de `withTenant` além da leitura legítima de `tenants` (`tenant.repository.ts`). Raw SQL é parametrizado e filtrado por tenant.

### 🔵 A1-1 (BAIXO) — Mutações de user/session dependem só da RLS (sem `tenantId` explícito)
- **Local:** `src/lib/repositories/user.repository.ts` (`registerFailedLogin`, `registerSuccessfulLogin`, `changePassword`, `acceptPrivacyNotice`, `updatePhotoUrl`, `updateConsentToggles`) e `src/lib/repositories/session.repository.ts` (`findValidSession`, `revokeSession`, `revokeOtherUserSessions`).
- **Descrição:** usam `update({ where: { id } })` sem par `tenantId`, ao contrário do resto do código (`updateMany({ where: { id, tenantId } })`).
- **Por que importa:** hoje é seguro (o id vem da sessão confiável e a RLS `FORCE` esconde linhas de outro tenant — um `.update()` cross-tenant lança P2025). É inconsistência com o padrão belt-and-suspenders do projeto; risco de drift se um helper for reusado com id de fonte menos confiável.
- **Correção sugerida:** padronizar para `updateMany({ where: { id, tenantId } })` e passar `tenantId` aos helpers de sessão. Sem mudança de comportamento legítimo.

### 🔵 A1-2 (BAIXO) — `findTenantBranding(tenantId)` não é estruturalmente vinculado ao tenant
- **Local:** `src/lib/repositories/tenant.repository.ts:26-32`.
- **Descrição:** lê branding de um `tenantId` arbitrário via `appDb` contra a tabela sem RLS `tenants`.
- **Por que importa:** muito baixo — todos os callers passam `session.tenantId` e o dado (logo, cor) é público/não-pessoal. Mas a função retornaria branding de qualquer tenant se recebesse id controlado pelo cliente.
- **Correção sugerida:** manter documentado o invariante (caller passa o tenant da sessão) ou receber a `ActiveSession`. Nada necessário para o piloto.

## Domínio 2 — Autenticação e sessão

**Veredito: desenho correto (ADR-007).** JWT é só ponteiro; toda rota protegida revalida a sessão fresca no banco (`getActiveSession` → `findValidSession` + status do usuário). Revogação funciona em todos os caminhos (logout, troca de senha revoga demais sessões, usuário inativo rejeitado). Nenhuma rota que serve dados o faz sem validação de sessão no banco. Login endurecido (erro genérico anti-enumeração, lockout 5 tentativas/15 min, CPF só como hash, argon2id/bcrypt). Escopo de filial do gestor forçado no servidor. Tabela rota→guard completa ao final deste domínio.

### 🟠 A2-1 (ALTO) — Middleware bloqueia o endpoint de cron; publicação agendada nunca dispara
- **Local:** `middleware.ts:19,40` × `src/app/api/cron/publish-announcements/route.ts:9-19`.
- **Descrição:** o matcher `"/((?!api/auth|_next/static|_next/image|favicon.ico).*)"` só exclui `api/auth`. `/api/cron/publish-announcements` é interceptado pelo middleware; não está em `PUBLIC_PATHS` e a chamada do cron externo vem **sem cookie de sessão**, então `req.auth?.user` é null → **redirect 307 para `/login`** antes do handler rodar. A checagem `Bearer ${CRON_SECRET}` do handler é inalcançável por uma chamada real.
- **Por que importa:** `runScheduledAnnouncementSweep` nunca executa em produção → comunicados agendados (feature-núcleo do INC-004, juridicamente relevante) nunca auto-publicam. Falha fechada (não é buraco de segurança), mas é bug real pré-piloto. Conflita com a doc do INC-004 (passo de teste 5 espera **401** sem o header, hoje responde 307) — reportado como conflito doc↔código.
- **Correção sugerida:** excluir `api/cron` do lookahead do matcher, ou curto-circuitar `/api/cron/*` no middleware antes da checagem de auth, deixando a autenticação por Bearer-secret do handler governar.

### 🟡 A2-2 (MÉDIO) — Duas rotas de API autenticadas, mas sem gate de onboarding
- **Local:** `src/app/api/media/[key]/route.ts:36,61`, `src/app/api/posts/[id]/card-image/route.ts:24`.
- **Descrição:** usam `getActiveSession()` (sessão válida + usuário ativo + escopo de tenant) mas não `requireOnboardedSession()`. Um usuário com `mustChangePassword` ou sem aceite de privacidade pode buscar mídia/card-image.
- **Por que importa:** inconsistência do gate de onboarding, não bypass de auth (ainda precisam de token de mídia assinado / conhecer o id do post publicado, inalcançáveis pela UI pré-onboarding). Ordenação de consentimento LGPD.
- **Correção sugerida:** decidir intencionalmente se devem exigir onboarding; se sim, gatear (ou documentar a exceção).

### 🟡 A2-3 (MÉDIO) — Manifest, ícones e página offline bloqueados quando deslogado
- **Local:** `middleware.ts:19` × `src/app/manifest.ts`, `src/app/icon-*.png/route.ts`, `src/app/offline/page.tsx`.
- **Descrição:** `/manifest.webmanifest`, `/icon-*.png` e `/offline` são interceptados pelo middleware e não estão em `PUBLIC_PATHS`; um navegador não autenticado (na tela `/login`) é redirecionado ao pedir esses recursos.
- **Por que importa:** mina a instalabilidade/offline do INC-012 na tela pública de login (manifest e ícones não carregam antes do login). Não é problema de segurança.
- **Correção sugerida:** adicionar esses caminhos estáticos de PWA à allowlist pública / exclusões do matcher.

### 🔵 A2-4 (BAIXO) — Segredo do cron comparado com `!==` (não constant-time)
- **Local:** `src/app/api/cron/publish-announcements/route.ts:16`.
- **Descrição:** `authHeader !== `Bearer ${secret}`` não é comparação de tempo constante (canal lateral de timing teórico).
- **Por que importa:** risco muito baixo (segredo de alta entropia, jitter de rede domina). A camada de mídia já faz certo com `timingSafeEqual` (`media-storage.ts:33`).
- **Correção sugerida:** usar `timingSafeEqual`, espelhando media-storage.

### 🔵 A2-5 (BAIXO) — Aceite de privacidade gravável fora de ordem / sem ver o aviso
- **Local:** `src/app/aviso-privacidade/actions.ts:9-16`.
- **Descrição:** `acceptPrivacyNoticeAction` usa `requireSession()` (não onboarded) e grava `acceptPrivacyNotice` sem checar `mustChangePassword` nem que a página foi renderizada. Um usuário com `mustChangePassword=true` poderia POSTar a action direto e setar `privacyAcceptedAt` antes de trocar a senha.
- **Por que importa:** não é bypass de onboarding (`requireOnboardedSession` ainda força a troca depois), mas o timestamp de consentimento pode ser escrito sem o gate de visualização — fragilidade probatória LGPD leve.
- **Correção sugerida:** se a integridade da visualização do consentimento importa, espelhar o guard de `mustChangePassword` da página na action.

### Tabela rota → guard

| Rota | Tipo | Guard(s) | Nota |
|---|---|---|---|
| `/login`, `/403` | page | público (middleware) | |
| `/trocar-senha` | page+action | middleware + `requireSession` | passo de onboarding (intencionalmente não-onboarded) |
| `/aviso-privacidade` | page+action | middleware + `requireSession` + checagens na página | ver A2-5 |
| `/offline`, `/manifest.webmanifest`, `/icon-*.png` | page/route/metadata | middleware (exige sessão) | **A2-3** (bloqueado deslogado) |
| `(app)/` , `/comunicados`, `/comunicados/[id]` | page/action | `requireOnboardedSession` | |
| `(app)/aniversariantes` | page | `requireOnboardedSession` | INC-010 |
| `(app)/vagas`, `/vagas/[id]` | page | `requireOnboardedSession` | INC-011 |
| `(app)/perfil` (+actions, push-actions) | page/action | `requireOnboardedSession` | INC-012 |
| `(app)/layout` | layout | `requireOnboardedSession` | nav resolvida no servidor |
| `(app)/pendencias/**` (+export) | layout/page/action/route | `requireAdminOrManager` | manager escopado à própria filial; `?filial` não sobreponível |
| `(app)/admin/**` (+vagas/export) | layout/page/action/route | `requireAdmin` (+ gate rápido `/admin` no middleware) | |
| `/api/media/[key]` (GET/PUT) | route | `getActiveSession` + token assinado + authz por namespace | **A2-2** (sem gate de onboarding) |
| `/api/posts/[id]/card-image` | route | `getActiveSession` + escopo de tenant | **A2-2**; INC-009 |
| `/api/cron/publish-announcements` | route | Bearer `CRON_SECRET` (sem sessão, por desenho) | **A2-1**: inalcançável — middleware redireciona antes |
| `/api/health` | route | público | sem dados |
| `/api/auth/[...nextauth]` | route | NextAuth (única exclusão do matcher) | |

## Domínio 3 — LGPD e dados pessoais

**Veredito: em boa forma.** CPF nunca armazenado/logado em claro — `hashCpf` = HMAC-SHA256(pepper, cpf) usado consistentemente em login/criação/import/seed; exports CSV contêm nome/matrícula/timestamps mas **não CPF**. Consentimentos (`photoVisible`/`birthdayVisible`) resolvidos **no render**, sempre do valor atual do banco (nunca snapshot), em todas as superfícies: feed, cards nativos, cards satori/PNG, aniversariantes, people picker, preview. AuditLog não grava dado pessoal sensível. Revogação de acesso no desligamento (`status=inactive` + revoke de sessões) é imediata.

### 🟠 A3-1 (ALTO) — Ciclo de anonimização de desligados (ADR-006) inexistente
- **Local:** ausência em `src/` (grep `anonym|retention|scrub|purge` → 0 hits); `prisma/schema.prisma:140` (`anonymizedAt` pré-cabeado, nunca lido/escrito).
- **Descrição — gap exato:**
  1. Nenhuma rotina/job de anonimização (nada escreve `anonymizedAt` nem sobrescreve `fullName/photoUrl/phone/email/birthDate/cpfHash` com pseudônimo).
  2. Nenhum prazo de retenção configurável por tenant (`Tenant` sem campo; default proposto 24 meses).
  3. Nenhuma geração de rótulo pseudonimizado ("Colaborador #…").
  4. Nenhuma lógica de preservação de ack pós-anonimização (manter `AnnouncementAck` ligado ao id pseudonimizado pelo prazo trabalhista).
  5. Nenhum fluxo de término de contrato de tenant (export + eliminação/anonimização).
  6. Nenhum procedimento de rotação de pepper do `cpf_hash` (ADR-006 linha 40).
  7. Aviso de privacidade é placeholder (`src/lib/privacy/notice.ts` = `PENDENTE-JURÍDICO`).
- **Por que importa:** LGPD Art. 15/16 (término do tratamento/eliminação) + `lgpd-requisitos-tecnicos.md` linhas 25-27. Reter dados pessoais de desligados indefinidamente carece de base legal após a retenção.
- **Severidade ALTO (não CRÍTICO):** escopo explícito do INC-013; `anonymizedAt` já no schema; no go-live nenhum registro atinge ainda a janela de 24 meses (sem violação no dia 1). **Obrigatório antes de dados reais em produção.**
- **Correção sugerida:** implementar no INC-013 — `Tenant.retentionMonths` (migration à mão, ADR-008), job agendado que carimba `anonymizedAt` e sobrescreve PII com pseudônimo preservando acks, e documentar rotação de pepper.

### 🟡 A3-2 (MÉDIO) — Histórico de mudança de consentimento é lossy
- **Local:** `src/lib/repositories/user.repository.ts:74-94` (`updateConsentToggles`); schema `prisma/schema.prisma:134,146`.
- **Descrição:** guarda só o último `birthdayVisibleChangedAt`/`photoVisibleChangedAt`, sobrescrevendo o anterior. Um revoke-depois-regrant perde o timestamp anterior.
- **Por que importa:** `lgpd-requisitos-tecnicos.md` linha 27 pede "registro de quando foram dados/revogados" — a redação bidirecional sugere histórico de eventos, não só a última transição.
- **Correção sugerida:** se o jurídico quiser trilha completa, registrar eventos de consentimento como linhas append-only (`ConsentEvent`) em vez de um único timestamp mutável. Confirmar interpretação com o dono da doc (docs vence).

### 🔵 A3-3 (BAIXO) — Metadata de audit grava `registrationCode`
- **Local:** `src/app/(app)/admin/colaboradores/novo/actions.ts:74`.
- **Descrição:** grava `metadata: { registrationCode }` na trilha; a matrícula é identificador interno de negócio (pessoal-adjacente).
- **Por que importa:** minimização de dados (LGPD Art. 6). O `entityId` já guarda o id do novo usuário, tornando a matrícula arguivelmente redundante.
- **Correção sugerida:** remover `registrationCode` da metadata e confiar no `entityId`, ou confirmar retenção intencional para auditoria legível. Baixo porque matrícula não é sensível e o propósito é legítimo.

## Domínio 4 — Integridade do núcleo jurídico

**Veredito: núcleo sólido.** `AnnouncementAck` imutável em 3 camadas independentes (grant SELECT/INSERT apenas + trigger BEFORE UPDATE/DELETE + trigger BEFORE TRUNCATE + zero métodos de mutação no repo) — **nenhum caminho de mutação encontrado**, inclusive via cascade (o trigger BEFORE aborta o cascade; `conecta_app` não tem DELETE nos pais). Corrida hash-vs-edição (INC-005) **intacta**: hash computado uma vez na criação da versão, ack grava `contentHashAtAck = version.contentHash` (nunca conteúdo atual), versão material reabre pendência via `computeRequiredAckVersionNumber`, idempotência por unique + ON CONFLICT. Numeração CI NN/AAAA à prova de corrida (UPSERT atômico `ON CONFLICT DO UPDATE ... RETURNING`, isolado por tenant+ano, atômico com a gravação de status; rede final: unique `(tenant_id, year, seq_number)`) — **nenhuma janela de duplicação**.

### 🟠 A4-1 (ALTO) — Imutabilidade assimétrica: `announcement_versions` e `audit_logs` sem trigger
- **Local:** `prisma/migrations/20260710120319_rls_and_triggers/migration.sql:37,39` (grants) vs `:96-109` (triggers só para acks).
- **Descrição:** `announcement_versions` e `audit_logs` têm **só o grant** SELECT/INSERT — nenhum trigger de bloqueio de UPDATE/DELETE e nenhuma proteção contra TRUNCATE. Ambas são núcleo probatório (a versão carrega o texto lido/confirmado; o audit_log é a trilha de quem fez o quê).
- **Por que importa:** a imutabilidade depende inteiramente de o grant nunca ganhar UPDATE/DELETE e de a role nunca virar owner/superuser. Uma migration futura descuidada (`GRANT … UPDATE`) ou um TRUNCATE por role privilegiada derruba a garantia silenciosamente — sem a 2ª linha de defesa (`RAISE EXCEPTION`) que o ack tem.
- **Correção sugerida:** replicar o padrão `forbid_*_mutation` (BEFORE UPDATE OR DELETE FOR EACH ROW + BEFORE TRUNCATE FOR EACH STATEMENT) para as duas tabelas, em nova migration aplicada com `prisma migrate deploy`. Se append-only for requisito jurídico (provável), elevar a decisão a ADR.

### 🟡 A4-2 (MÉDIO) — `audit_logs.actor_user_id` é `ON DELETE SET NULL`: perda de atribuição
- **Local:** `prisma/migrations/20260710120307_init/migration.sql:339`.
- **Descrição:** deletar um `user` zera o ator em todas as linhas de audit_log dele — mutação de registro probatório. Não alcançável pela aplicação hoje (sem DELETE grant em `users`), mas exposto a operação de banco fora de banda.
- **Por que importa:** a defensibilidade da trilha depende do "quem" permanecer estável; SET NULL apaga o "quem" retroativamente.
- **Correção sugerida:** avaliar `ON DELETE RESTRICT` para `actor_user_id`, ou desnormalizar nome/identificador do ator no INSERT. Decisão de modelagem → pergunta/ADR.

### 🟡 A4-3 (MÉDIO) — Toda a defesa RLS/grant depende de `APP_DATABASE_URL` → `conecta_app`, sem checagem
- **Local:** `src/lib/db/app-client.ts:14-18`.
- **Descrição:** se `APP_DATABASE_URL` for configurada em prod com a role owner/superuser, RLS e todos os grants restritivos viram decorativos e a imutabilidade por grant (A4-1) evapora — nada no código detecta.
- **Por que importa:** um erro de env silencioso desfaz simultaneamente o isolamento multi-tenant e a imutabilidade por grant.
- **Correção sugerida:** checagem de boot validando `current_user = 'conecta_app'` e/ou `SELECT rolsuper FROM pg_roles WHERE rolname = current_user` = false, falhando o start caso contrário; documentar no `.env.example`.

### 🟡 A4-4 (MÉDIO) — Ano da sequência CI em UTC, não em America/Sao_Paulo
- **Local:** `src/lib/announcements/publish.ts:31` (`new Date().getUTCFullYear()`).
- **Descrição:** o ano que compõe `CI NN/AAAA` e a chave do contador vêm de UTC. Brasil é UTC-3: na janela ~21:00–23:59 (BRT) de 31/dez, o UTC já está no ano seguinte → um comunicado nessa faixa recebe `CI 01/AAAA+1` enquanto a organização ainda está no ano anterior.
- **Por que importa:** o número CI é identificador legal sequencial-por-ano; salto de ano 3h antes da virada brasileira é anomalia audível e diverge da regra de fuso do CLAUDE.md.
- **Correção sugerida:** derivar o ano em America/Sao_Paulo (mesma conversão da exibição), mantendo UTC no armazenamento dos timestamps. Confirmar a semântica com a doc.

### 🔵 A4-5 (BAIXO) — Ack confia no `versionId` vindo do formulário
- **Local:** `src/app/(app)/comunicados/[id]/actions.ts:29,40-49`, `page.tsx:84`.
- **Descrição:** o `versionId` é hidden field; a action só valida que pertence ao announcement, não que seja a versão exibida. Um usuário poderia forjar o POST com o `versionId` de outra versão (do mesmo comunicado, visível a ele) e gravar ack+hash de versão nunca exibida. Só afeta o próprio usuário.
- **Por que importa:** o valor jurídico do ack é "esta pessoa viu exatamente este texto"; confiar no versionId do cliente afrouxa esse elo.
- **Correção sugerida:** derivar/validar a versão no servidor (ex.: exigir `AnnouncementRead` do usuário para aquele `versionId`, ou vincular ao versionId lido server-side).

### 🔵 A4-6 (BAIXO) — Lacunas na sequência CI por número consumido em publish "skipped"
- **Local:** `src/lib/announcements/publish.ts:32-42`.
- **Descrição:** o contador incrementa antes de `markAnnouncementPublished`; se este bater count 0 (corrida do mesmo rascunho), o número consumido vira lacuna permanente. Explicitamente aceito no comentário.
- **Por que importa:** não é falha de integridade (nunca duplica), é rastreabilidade ("cadê a CI 05/2026?").
- **Correção sugerida:** se auditoria de lacunas for exigida, registrar audit_log ao consumir número sem publicar, ou consumir o número só após confirmar o UPDATE (custo de contenção). Decisão de produto.

## Domínio 5 — INC-012 (PWA + Web Push)

**Veredito sobre "cliques não respondem em componentes client": causa-raiz identificada e JÁ CORRIGIDA no código atual.** O SW original (`94e69cd`) interceptava `_next/static/*.js` em cache-first; após deploy, o HTML fresco referenciava chunks novos mas o SW servia bundles velhos → **hidratação falhava → nenhum `onClick` respondia** (enquanto `<Link>`/navegação HTML seguiam funcionando, mascarando o diagnóstico). Agravado por registrar o SW inclusive em `next dev`. A correção (`b2302a1`) está **correta e completa**: `public/sw.js:66-73` só trata navegação GET same-origin (scripts/estilos/imagens não passam mais pelo SW); cache renomeado `conecta-shell-v2` com purga de caches antigos + `skipWaiting`/`clients.claim` (cura dispositivos já infectados); `service-worker-register.tsx:21-34` só registra em produção e **desregistra ativamente** em dev. O eixo secundário (mismatch iOS por `navigator.userAgent === "Node.js/…"` no SSR) está resolvido via `useSyncExternalStore` com `getServerSnapshot` = false (`platform.ts:37-43`), com teste travando a regra. **Traço do root/app layout:** nenhum componente PWA pode lançar antes/durante a hidratação hoje. SW **nunca** intercepta não-GET nem cross-origin → Server Actions (POST), uploads e mutações passam direto pela rede.

### 🟡 A5-1 (MÉDIO) — `response.clone()` chamado depois do `return` na navegação do SW
- **Local:** `public/sw.js:50-57`.
- **Descrição:** o clone acontece no `.then` diferido de `caches.open(...)`, **depois** de `return response`. Clonar uma `Response` cujo corpo já começou a ser transmitido lança `TypeError`; o `.catch(() => {})` engole o erro.
- **Por que importa:** a navegação nunca quebra, mas **a gravação no cache falha intermitente e silenciosamente**, minando o critério "leitura offline das últimas telas visitadas" (a página pode nunca ter sido de fato cacheada).
- **Correção sugerida:** clonar antes de retornar (`const copy = response.clone(); … cache.put(request, copy); return response;`).

### 🟡 A5-2 (MÉDIO) — Falha de push é silenciosa e sem log; `setVapidDetails` pode lançar
- **Local:** `src/lib/notifications/push-channel.ts:15-22,39-52`.
- **Descrição:** `defaultSendPush` chama `webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "", …)` a cada envio; se `VAPID_SUBJECT` estiver vazio/ausente em prod, lança sincronamente dentro do `try` do loop, e o `catch` só trata 404/410 — todo o resto é descartado sem log. Push nunca sai e **nada é observável**.
- **Por que importa:** o critério "Push recebido em Android real" falharia mudo. O silenciamento para não abortar a transação é intencional, mas deveria **logar** o erro não-404/410.
- **Correção sugerida:** log estruturado (sem dado pessoal) no ramo de erro; validar env VAPID na inicialização.

### 🔵 A5-3 (BAIXO) — Metadata `appleWebApp` ausente
- **Local:** `src/app/layout.tsx:13-16`.
- **Descrição:** falta `appleWebApp: { capable, statusBarStyle, title }`. No iOS 16.4+ a instalação funciona via manifest, então não é bloqueante; mas a barra de status/experiência standalone no iOS fica sem controle. `apple-icon.tsx` (180×180) está presente e correto.
- **Correção sugerida:** adicionar `appleWebApp` ao metadata do root layout.

### 🔵 A5-4 (BAIXO) — `setVapidDetails` reconfigurado a cada envio
- **Local:** `src/lib/notifications/push-channel.ts:16-20`.
- **Descrição:** recredencia VAPID por notificação/subscription no laço de cobrança. Ineficiência menor.
- **Correção sugerida:** configurar uma vez (módulo/boot).

> **Observação:** o acoplamento da chamada HTTP de push à transação de banco está registrado em A7-3 / DP-17 (dívida documentada), não repetido aqui.

## Domínio 6 — Consistência doc ↔ código

**Veredito:** o **código é fiel a todos os 9 ADRs Aceitos** (incluindo garantias estruturais de RLS e imutabilidade). Nenhum caso de código violando garantia de segurança/LGPD prometida na doc. O problema é quase inteiro **defasagem da documentação de roadmap/status/modelo-de-dados**. Design system bate quase exato com `globals.css`. Todas as DPs citadas em qualquer doc estão registradas em `05-Decisoes-Pendentes.md`.

### 🟠 A6-1 (ALTO) — INC-009/010/011 concluídos e mergeados, mas roadmap e arquivos de INC marcam "⬜ Não iniciado"
- **Local:** `docs/04-Roadmap/roadmap.md:28-31`; `INC-009/010/011.md` (`Status: ⬜ Não iniciado`, `Registro de conclusão: _(preencher)_`).
- **Descrição:** `git log` mostra `feat(INC-009/010/011)` + merges na main; código presente e completo. Doc não reflete.
- **Por que importa:** viola a Regra Inviolável nº 4 (INC só termina com Relatório de Entrega) — features em produção sem artefato de fechamento; o roadmap deixa de ser fonte-de-verdade.
- **Correção sugerida:** marcar ✅ no roadmap e preencher Registro de Conclusão/Relatório de Entrega de 009, 010, 011. (Aqui o código é o fato; a doc está atrasada — corrigir a doc, não reverter código.)

### Tabela de completude

| INC | Código feito? | Roadmap ✅? | Relatório de Entrega? |
|---|---|---|---|
| 001–008.5 | ✅ | ✅ | ✅ |
| **009** | ✅ (main) | ❌ ⬜ | ❌ `_(preencher)_` |
| **010** | ✅ (main) | ❌ ⬜ | ❌ `_(preencher)_` |
| **011** | ✅ (main) | ❌ ⬜ | ❌ `_(preencher)_` |
| **012** | ✅ (branch atual, não mergeado) | ⬜ (em andamento) | ❌ + tabela iOS vazia (A6-4) |
| 013 | ❌ (não iniciado) | ⬜ | — (correto) |

### 🟡 A6-2 (MÉDIO) — `modelo-de-dados.md` desatualizado (entidades e campos ausentes)
- **Local:** `docs/02-Arquitetura/modelo-de-dados.md` × `prisma/schema.prisma`.
- **Descrição:**
  - Entidades `Notification` (INC-007) e `AnnouncementSequence` (INC-004) ausentes do doc conceitual.
  - `User` no doc (linhas 10-18) não lista `birthdayVisibleChangedAt`, `photoVisible`, `photoVisibleChangedAt`, `privacyAcceptedAt`, `privacyNoticeVersion`, `failedLoginAttempts`, `lockedUntil` (schema 133-148). Vários são **LGPD-relevantes** (consentimento, aceite de privacidade).
- **Por que importa:** a fonte-de-verdade está incompleta sobre dados pessoais. Sem violação (o código implementa), mas o documento de dados deveria refletir.
- **Correção sugerida:** atualizar `modelo-de-dados.md` (docs vence).

### 🟡 A6-3 (MÉDIO) — INC-003.5: Status header contradiz o próprio Relatório de Entrega
- **Local:** `docs/04-Roadmap/incrementos/INC-003.5-fundacao-design.md:3` (`Status: ⬜ Não iniciado — BLOQUEADO`) × mesmo arquivo linhas 34-77 (Relatório de Entrega completo, datado) + roadmap ✅ + código presente.
- **Correção sugerida:** corrigir o Status header para ✅ Concluído.

### 🟡 A6-4 (MÉDIO) — Critério de aceite do INC-012 (medição de push iOS) não preenchido
- **Local:** `docs/04-Roadmap/incrementos/INC-012-pwa-push.md` (critério "push testado em iPhone real, taxa registrada"); `docs/02-Arquitetura/pwa-push-ios.md` (tabela de medição toda `_(preencher)_`).
- **Descrição:** PWA/push implementados, mas o INC-012 **não pode ser considerado concluído** até a tabela de medição real ser preenchida (exigência ADR-002/ADR-006). É a branch atual, ainda não mergeada.
- **Correção sugerida:** preencher a medição no delivery report do INC-012 antes de fechar (ação de execução do INC).

### 🔵 A6-5 (BAIXO) — ADR-009 lista 6 itens no header admin, código tem 7 (Vagas)
- **Local:** `docs/02-Arquitetura/ADR/ADR-009-navegacao-por-papel.md` × `src/components/admin/admin-header-nav.tsx` (`ADMIN_LINKS` inclui `/admin/vagas`).
- **Correção sugerida:** adicionar "Vagas" à lista do ADR-009 (ou registrar no delivery do INC-011).

### 🔵 A6-6 (BAIXO) — `modelo-de-dados.md`: branding do `Tenant` e `tenant_id` de `PushSubscription`
- **Local:** doc linhas 8 e 19 × schema (`Tenant.logoUrl/accentColor` linhas 90-91; `PushSubscription.tenantId` linha 177).
- **Correção sugerida:** harmonizar o doc.

### 🔵 A6-7 (BAIXO) — DP-04 inexistente na numeração
- **Local:** `docs/05-Decisoes-Pendentes.md` (salta DP-03 → DP-05).
- **Correção sugerida:** nota no arquivo esclarecendo que DP-04 foi resolvida/removida, para evitar dúvida futura.

> **Nota de memória (INC-007/INC-009 doc lag):** INC-007 já resolvido; INC-009 **ainda defasado** e o padrão se estendeu a 010/011/012. Reforçar a atualização de doc no fechamento de cada INC.

## Domínio 7 — Qualidade e dívida técnica

### 🟡 A7-1 (MÉDIO) — Testes flaky: `DISABLE TRIGGER` global + arquivos em paralelo
- **Local:** `tests/integration/pending-panel.test.ts:35,45`, `pending-panel-performance.test.ts:103,119`, `remind-pending.test.ts:32,43`, `remind-pending-push.test.ts:33,45`; `vitest.config.ts` (sem override de paralelismo).
- **Descrição (diagnóstico confirmado):** os `afterAll` fazem `ALTER TABLE announcement_acks DISABLE TRIGGER USER` → `deleteMany` → `ENABLE TRIGGER` (finally). `DISABLE/ENABLE TRIGGER` **não é session-scoped** — muta `pg_trigger.tgenabled` global e persistente, com lock `ACCESS EXCLUSIVE`. O Vitest roda arquivos em paralelo (nenhum `fileParallelism`/`poolOptions`/`singleFork` em `vitest.config.ts`). Cada arquivo usa tenant único, então o único estado global compartilhado é o flag do trigger. Interleaving: arquivo A reativa o trigger (finally) enquanto o `deleteMany` do arquivo B ainda roda → B bate `RAISE EXCEPTION 'announcement_acks e imutavel: DELETE nao e permitido'`. Ordem entre arquivos é não-determinística → intermitência.
- **Correção sugerida:** trocar o toggle global por mecanismo **session-scoped**: envolver os `deleteMany` de limpeza em `ownerDb.$transaction` com `SET LOCAL session_replication_role = 'replica'` no início (desativa triggers só na transação corrente, sem mutar catálogo nem tomar `ACCESS EXCLUSIVE`). Alternativa inferior: serializar esses arquivos (`fileParallelism: false`), que penaliza o tempo total.

### 🟡 A7-2 (MÉDIO) — `npm audit`: 2 moderate (postcss via next)
- **Descrição:** `postcss <8.5.10` (XSS no CSS stringify) puxado transitivamente por `next`. `npm audit fix --force` rebaixaria o Next (breaking), não aceitável.
- **Por que importa:** severidade moderate, superfície de exploração baixa no contexto (não recebemos CSS de terceiros para stringify). Não bloqueia piloto.
- **Correção sugerida:** aguardar bump do Next que traga postcss corrigido; reavaliar no INC-013. Não forçar downgrade.

### 🟡 A7-3 (MÉDIO) — N+1 sequencial em `remindPendingUsers` (DP-17)
- **Local:** `src/lib/announcements/remind-pending.ts:33-41`; `src/lib/notifications/push-channel.ts:35-53`.
- **Descrição:** laço `for (user of pending) { await channel.send(tx, …) }` → por pendente: 1 INSERT (in-app) + 1 SELECT `findPushSubscriptionsForUser` + N chamadas HTTP de push, **tudo sequencial dentro de uma única transação aberta**. ~2N round-trips + N HTTP por cobrança. Clássico N+1 de escrita/leitura acoplado à transação.
- **Por que importa:** aceito para o piloto (poucos pendentes) e já documentado em **DP-17**; vira gargalo real em escala (transação mantida aberta por N chamadas de rede).
- **Correção sugerida (alinhada ao DP-17):** buscar subscriptions de todos os pendentes em 1 query; `createMany` para notificações in-app; desacoplar o envio de push da transação (gravar intenção na tx, enviar fora).

### 🔵 A7-4 (BAIXO) — Valores de CI em plaintext no `ci.yml`
- **Local:** `.github/workflows/ci.yml:17,27-31` (`conecta_ci`, `conecta_ci_app`, `conecta_ci_pepper`, `conecta_ci_cron_secret`).
- **Descrição:** credenciais **efêmeras/throwaway** de um Postgres de teste por execução — **não são segredos de produção**. Confirmado que nenhum segredo real jamais foi commitado (histórico git limpo; `.env` corretamente ignorado; `.env.example` completo).
- **Correção sugerida:** por higiene/consistência, migrar para GitHub Secrets. Não urgente.

### Verificado limpo (Domínio 7)
- Sem TODO/FIXME/HACK/XXX em `src/`. Sem testes `.skip`/`.todo`. Sem `any` não justificado. Sem `console.*` em caminho de produção. `eslint-disable` só `@next/next/no-img-element` com justificativa inline (satori/URL assinada).
- `.env.example` completo vs `process.env` do código (todas as chaves presentes). `.env` ignorado; nenhum segredo real no histórico.
- Sem N+1 nos demais view-builders (`pending-panel`, `list-for-user`, `build-feed-view`, `build-birthday-view`, `build-job-opening-view` — batch + `Promise.all` + `Map` pré-carregado).

---

# Proposta de ordem de correção

> Priorização sugerida; a decisão final é do Pedro. Nada foi corrigido nesta auditoria.

## Antes do piloto (bloqueiam / risco sério)
1. **A2-1 (ALTO)** — Corrigir o matcher do middleware para o cron disparar. *Sem isso, comunicado agendado não publica.* Barato e crítico funcionalmente.
2. **A4-1 (ALTO)** — Adicionar triggers de imutabilidade a `announcement_versions` e `audit_logs` (migration `migrate deploy`). Fecha a assimetria probatória.
3. **A4-3 (MÉDIO)** — Checagem de boot de que a conexão runtime é `conecta_app` não-superuser. Protege todo o resto contra um erro de env.
4. **A6-1 (ALTO) + A6-4 (MÉDIO)** — Preencher Relatórios de Entrega de 009/010/011 e a medição de push iOS do 012; marcar roadmap. *Regra nº 4; e o INC-012 não fecha sem a medição real em iPhone.*
5. **A5-1, A5-2 (MÉDIO)** — Corrigir o `response.clone()` do SW e a observabilidade/validação de env do push. Sem isso, offline e push podem falhar mudos no piloto (base com parcela relevante de iPhone).
6. **A2-3 (MÉDIO)** — Liberar manifest/ícones/offline na tela pública, senão a instalabilidade do PWA fica quebrada antes do login.
7. **A4-4 (MÉDIO)** — Ano do CI em America/Sao_Paulo (identificador legal correto na virada de ano).
8. **A7-1 (MÉDIO)** — Corrigir os testes flaky (`SET LOCAL session_replication_role`) para o verde do CI ser confiável antes do go-live.

## INC-013 (hardening pré-piloto)
- **A3-1 (ALTO)** — Ciclo completo de anonimização de desligados + retenção por tenant + preservação de ack + rotação de pepper + aviso de privacidade definitivo. **Obrigatório antes de dados reais.**
- **A4-2 (MÉDIO)** — Reavaliar `ON DELETE SET NULL` de `audit_logs.actor_user_id` (RESTRICT ou desnormalizar ator).
- **A3-2 (MÉDIO)** — Decidir com o jurídico se consentimento precisa de trilha append-only (`ConsentEvent`).
- **A2-2, A2-5 (MÉDIO/BAIXO)** — Gate de onboarding nas rotas de API; guard de ordem no aceite de privacidade.
- **A6-2, A6-3, A6-5, A6-6, A6-7 (MÉDIO/BAIXO)** — Sincronizar `modelo-de-dados.md`, headers de INC, ADR-009, DP-04.
- **A2-4, A4-5 (BAIXO)** — `timingSafeEqual` no cron; vincular ack à versão vista no servidor.
- **A3-3 (BAIXO)** — Remover `registrationCode` da metadata de audit.

## Backlog (melhoria/polimento / dívida controlada)
- **A7-3 / DP-17 (MÉDIO)** — Desacoplar push da transação quando o volume de pendentes crescer (dívida já rastreada; não urgente no piloto).
- **A7-2 (MÉDIO)** — Bump de postcss quando o Next liberar.
- **A1-1, A1-2 (BAIXO)** — Padronizar `updateMany({ id, tenantId })`; documentar invariante de `findTenantBranding`.
- **A4-6 (BAIXO)** — Registro de lacunas na sequência CI, se auditoria de lacunas virar requisito.
- **A5-3, A5-4 (BAIXO)** — `appleWebApp` metadata; `setVapidDetails` uma vez.
- **A7-4 (BAIXO)** — Migrar valores de CI para GitHub Secrets.

---

*Auditoria gerada em 2026-07-16, read-only, sobre `inc-012-pwa-push@46a0122`. Cobertura: 7 domínios, 32 achados (0 CRÍTICO / 4 ALTO / 14 MÉDIO / 14 BAIXO). Testes de integração não foram executados (Postgres local indisponível) — revalidar com a suíte rodando antes de tratar qualquer garantia como testada.*
