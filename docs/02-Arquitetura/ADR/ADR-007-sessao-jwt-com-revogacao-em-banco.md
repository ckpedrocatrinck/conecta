# ADR-007 — Sessão: JWT do Auth.js com revogação verificada em banco

**Status:** Aceito
**Aceito em:** 2026-07-10 (Pedro Catrinck)
**Data:** 2026-07-10
**Decisores:** Pedro Catrinck
**Relaciona-se com:** ADR-003, ADR-005, ADR-006, LGPD (sessões revogáveis)

## Contexto
ADR-005 já decidiu Auth.js (credentials) para autenticação. LGPD
(`lgpd-requisitos-tecnicos.md`) e ADR-006 exigem "sessões server-side
revogáveis; logout invalida de verdade" — um requisito não-funcional
permanente, não específico deste INC.

Ao desenhar o INC-003, encontramos uma limitação real da biblioteca: o
`CredentialsProvider` do Auth.js **não suporta a estratégia de sessão
"database"** — funciona apenas com `session.strategy = "jwt"` (limitação de
design da própria lib, não uma escolha nossa). Um JWT puro, por definição, não
é revogável no servidor: uma vez emitido, continua válido até expirar, mesmo
que o usuário faça logout — o que contradiz diretamente o requisito de LGPD.

Além disso, o adapter padrão do Auth.js (`@auth/prisma-adapter`) assume um
schema de usuário/sessão que não é o nosso: nosso `User` é multi-tenant,
autenticado por `cpf_hash`, e toda tabela de domínio passa pela camada de
acesso `withTenant`/RLS (ADR-003) — usar o adapter padrão significaria abrir
uma via de acesso ao banco que não respeita esse contrato.

## Decisão
Sessão = **JWT (via Auth.js, `session.strategy: "jwt"`) + tabela `Session`
própria**, tratada como qualquer outra tabela de domínio (`tenant_id`, RLS,
acessada só via `withTenant`).

- No login bem-sucedido, criamos uma linha em `Session` (`id, tenant_id,
  user_id, expires_at, revoked_at?, created_at`) e embutimos `sessionId` (e
  `tenantId`, `userId`, `role`) no JWT.
- Em toda rota protegida, o middleware/callback de sessão confere no banco
  (via `withTenant`) que a linha `Session` referenciada pelo JWT ainda existe,
  não está revogada e não expirou. Sessão inválida no banco ⇒ tratada como não
  autenticado, independente do que o JWT diga.
- Logout (`events.signOut` do Auth.js) marca `revoked_at = now()` na linha —
  isso é o que torna "logout invalida de verdade" verdade, não a expiração do
  cookie no cliente.
- O JWT nunca é a fonte de verdade sobre validade da sessão — é só um ponteiro
  assinado para a linha em `Session`, que é a fonte de verdade.

## Alternativas consideradas
- **Confiar só no JWT (sem tabela `Session`)** — é o caminho "de fábrica" do
  Credentials provider, mas torna logout cosmético (o token continua válido
  até expirar) e viola LGPD/ADR-006 diretamente; rejeitada.
- **`@auth/prisma-adapter` com sessão "database"** — não é suportado pelo
  Credentials provider (limitação da lib) e, mesmo se fosse, o schema do
  adapter não é multi-tenant nem passa pela RLS (ADR-003); rejeitada.
- **Session store fora do Postgres (ex.: Redis)** — resolveria revogação, mas
  Redis está explicitamente fora da stack do MVP (`stack.md`); rejeitada.
- **JWT de vida curtíssima sem tabela, forçando re-login frequente** — reduz
  a janela de "logout não efetivo" mas não a elimina, e piora UX mobile-first
  sem resolver o requisito; rejeitada.

## Consequências
+ Logout e revogação de sessão são reais, não cosméticos — cumpre LGPD/ADR-006.
+ `Session` segue exatamente o mesmo padrão de toda tabela de domínio já
  estabelecido pelo INC-002 (tenant_id + RLS + `withTenant`) — nenhuma exceção
  arquitetural nova, só mais uma tabela na família.
+ Mantém Auth.js (ADR-005) sem adotar o adapter padrão, que não serviria ao
  nosso modelo multi-tenant de qualquer forma.
− Cada request a rota protegida paga uma consulta a mais (verificação da
  linha `Session`) — aceito conscientemente em troca de revogação real; se
  virar gargalo medido, é gatilho de revisão (ver abaixo).
− Duas fontes de identidade da sessão (JWT + linha em banco) exigem manter as
  duas em sincronia; mitigado por `sessionId` ser a única ponte entre elas (o
  JWT não carrega nenhum outro dado sensível que precise ser revalidado).

## Gatilho de revisão
- Medição real mostrar que a consulta de verificação por request é gargalo de
  performance → avaliar cache de curdíssima duração (ex.: alguns segundos) da
  validade da sessão, sem abrir mão da revogação.
- Auth.js passar a suportar sessão "database" com Credentials provider em
  versão futura → reavaliar se compensa migrar para o adapter oficial.
