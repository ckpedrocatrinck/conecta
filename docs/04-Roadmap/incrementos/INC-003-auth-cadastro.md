# INC-003 — Autenticação, papéis e cadastro

**Status:** 🔄 Implementado, aguardando revisão de Pedro
**Fase:** 1
**Depende de:** INC-002
**ADRs relevantes:** 003, 006
**Docs:** LGPD (senha, CPF hash, aviso de privacidade)

## Objetivo
Login funcional por CPF + senha, papéis aplicados, e RH capaz de popular a base.

## Escopo
1. Auth.js credentials: login por **CPF completo** + senha (ADR-006). CPF normalizado → `cpf_hash` determinístico com pepper (env) para localizar o usuário; senha com argon2id/bcrypt; sessão server-side revogável; rate limit no login. CPF nunca em claro no banco nem em log.
2. Primeiro acesso: senha provisória definida no import → troca obrigatória → exibição do aviso de privacidade (conteúdo placeholder marcado como PENDENTE-JURÍDICO) com aceite registrado.
3. Papéis admin | manager | employee aplicados em middleware/layout (admin acessa painel; employee não).
4. CRUD de filiais e colaboradores no painel admin.
5. Import CSV de colaboradores: template documentado, validação linha a linha com relatório de erros, idempotente (reimport atualiza por matrícula).
6. Perfil "Meus dados": visualizar dados, trocar senha, foto (upload R2/S3 com URL não pública), toggles de consentimento (foto visível, aniversário visível) — efeito imediato.

## Critérios de aceite
- [x] Fluxo completo: import CSV → primeiro login **por CPF** → troca de senha → aceite do aviso → home.
- [x] Employee tentando rota admin recebe 403/redirect.
- [x] Logout invalida sessão de verdade (sessão antiga não funciona).
- [x] CPF nunca em claro no banco nem em logs; `cpf_hash` é determinístico e o pepper vem de env (não do repo).
- [x] Toggles de consentimento persistem com timestamp.

## Registro de conclusão

## Relatório de Entrega — INC-003
**Data:** 2026-07-10
**Branch:** inc-003-auth-cadastro

### O que foi implementado

1. **Auth por CPF + seleção de empresa (Auth.js Credentials).** A RLS forçada
   em `users` (INC-002) exige o `tenant_id` antes de qualquer query — não há
   como buscar `cpf_hash` "globalmente" sem furar essa garantia no único
   endpoint não autenticado do sistema. Apresentei essa restrição a Pedro com
   3 opções; ele confirmou **seleção de empresa no login** (dropdown de
   tenants ativos + CPF completo + senha).
2. **Sessão revogável (ADR-007, novo).** O Credentials provider do Auth.js só
   suporta sessão via JWT — não "database strategy". Para cumprir "logout
   invalida de verdade" (LGPD/ADR-006), criei a tabela `Session` (tenant-scoped,
   RLS igual a qualquer tabela de domínio) como fonte de verdade; o JWT só
   carrega um ponteiro (`sessionId`). `requireSession()`/`requireOnboardedSession()`/
   `requireAdmin()` (`src/lib/auth/session.ts`) sempre confirmam no banco que a
   sessão não foi revogada/expirada e que o usuário ainda está ativo.
3. **Rate limit sem Redis.** `failed_login_attempts`/`locked_until` no próprio
   `User` — 5 tentativas erradas trancam a conta por 15 min.
4. **Fluxo de primeiro acesso.** `/trocar-senha` (obrigatório, `mustChangePassword`)
   → `/aviso-privacidade` (conteúdo placeholder marcado **PENDENTE-JURÍDICO**,
   aceite grava `privacyAcceptedAt`/`privacyNoticeVersion`) → home.
5. **Papéis em middleware + guard server-side.** `middleware.ts` faz o guard
   rápido (edge-safe, só JWT: sessão existe? papel admin?); a checagem
   autoritativa (revogação, status, senha trocada, aviso aceito) mora em
   `session.ts`, chamada em toda página/action protegida.
6. **"Meus dados"**: dados cadastrais, toggles de consentimento (aniversário/
   foto, **com timestamp de mudança** — só carimba quando o valor muda de
   verdade), troca de senha voluntária, upload de foto.
7. **Upload de foto — mock plugável (combinado com Pedro).** `src/lib/storage/media-storage.ts`
   define a interface (`getUploadUrl`/`getViewUrl`); a implementação deste
   INC é local, mas já respeita o contrato real (key não pública, exibição só
   via URL assinada de TTL curto, validação de tipo/tamanho). R2 real fica
   para um INC futuro — só trocar a implementação por trás da interface.
8. **CRUD admin** de filiais (criar/editar/remover — bloqueado se houver
   colaborador vinculado) e colaboradores (criar, editar, desligar/reativar,
   redefinir senha). Toda ação grava `AuditLog`.
9. **Import CSV** idempotente por matrícula (reimport atualiza cadastro,
   nunca senha/CPF de quem já existe), validação linha a linha sem abortar o
   arquivo inteiro por uma linha ruim, senha provisória gerada pelo sistema
   e mostrada uma única vez na tela.

### Decisões tomadas durante a implementação

- **ADR-007 (novo, Aceito):** sessão JWT + tabela `Session` verificada em
  banco — ver `docs/02-Arquitetura/ADR/ADR-007-sessao-jwt-com-revogacao-em-banco.md`.
  Aprovada por Pedro como condição para eu começar o código de auth.
- **`next-auth` pinado em `5.0.0-beta.31` (exato, sem `^`)** — não existe v5
  estável ainda; documentado em `stack.md` no mesmo estilo da nota do Prisma.
- **Campos novos no `User`** além do que o INC-002 previa:
  `failedLoginAttempts`/`lockedUntil` (rate limit), `photoVisible` +
  `photoVisibleChangedAt`/`birthdayVisibleChangedAt` (o critério de aceite
  exige timestamp no consentimento, não só o booleano — `birthdayVisible` já
  existia sem isso desde o INC-002), `privacyAcceptedAt`/`privacyNoticeVersion`.
- **Senha provisória** (import/cadastro manual/redefinição): gerada pelo
  sistema, nunca vem do CSV, aparece uma única vez na tela (nunca logada/
  persistida em claro).
- **Reimport CSV nunca toca `password_hash`/`cpf_hash`/`must_change_password`**
  de quem já existe — só define isso em linhas novas.
- **Colaborador "deletado" = `status=inactive`**, nunca um DELETE de verdade
  (ADR-006). Filial só bloqueia remoção se tiver colaborador vinculado (FK
  `Restrict`, checado antes via `count` para dar um erro amigável).
- **Bug real encontrado na verificação manual, corrigido:** `middleware.ts`
  importava a config completa do Auth.js (com o Credentials provider), que
  depende de `node:crypto` e Postgres direto — nenhum dos dois roda no Edge
  Runtime (onde o Next.js roda middleware por padrão). O middleware nunca
  autenticava ninguém de verdade. Corrigido separando `edge-config.ts`
  (session/callbacks, sem providers) de `config.ts` (Node-only) — padrão
  recomendado pelo próprio Auth.js v5.
- **Bug de infra de teste encontrado e corrigido:** dois arquivos de teste de
  integração chamando `ensureAppRolePassword()` no próprio `beforeAll`, rodando
  em paralelo, colidiam (`tuple concurrently updated` no Postgres). Extraído
  para um `globalSetup` do vitest (roda uma vez, não por arquivo).

### Como testar

1. `docker compose up -d` (se ainda não estiver rodando) e `npm run db:seed`
   (idempotente — se o tenant "Rede Vale Verde" já existir, não faz nada).
2. **Confirme que seu `.env` tem `AUTH_SECRET`** (acrescentei uma entrada nova
   no `.env.example`; se seu `.env` local não tiver essa variável, o login
   falha com "MissingSecret" — gere qualquer string aleatória para dev).
3. `npm run dev` → `http://localhost:3000/login`.
4. Selecione "Rede Vale Verde", CPF `10000000000`, senha `Trocar123!`
   (admin seed) → deve forçar troca de senha → aviso de privacidade → home
   ("Bem-vindo(a), Colaborador 0-1").
5. Vá em `/admin` — deve funcionar (é admin). Filiais/Colaboradores/Importar
   CSV estão no menu.
6. Deslogue ("Sair" na home) e tente usar o botão "voltar" do navegador ou
   recarregar uma aba antiga logada — a sessão antiga não deve mais dar acesso.
7. Repita o login com um CPF de `employee` do seed (ex. `10000000004`) e tente
   acessar `/admin` — deve cair em "Acesso negado" (403).
8. Testes automatizados: `npm run lint && npm run typecheck && npm run test`
   (51 testes, incluindo integração contra Postgres real).

Verifiquei o fluxo inteiro (passos 3–7) com um Chromium real via Playwright
antes de entregar — foi assim que os dois bugs acima (middleware edge/Node e
a corrida no setup de teste) apareceram. Os usuários de seed usados na
verificação (`Colaborador 0-1` e `Colaborador 0-5`) foram resetados de volta
ao estado de seed (senha original, `must_change_password=true`, sem aviso
aceito) ao final — o banco local fica como se você nunca tivesse testado.

### Critérios de aceite

- [x] Fluxo completo: import CSV → primeiro login por CPF → troca de senha →
  aceite do aviso → home. — Verificado ponta a ponta em navegador real
  (Playwright); CSV coberto por teste de integração (`applyEmployeeCsvRow`).
- [x] Employee tentando rota admin recebe 403/redirect. — Verificado em
  navegador real (`/403`, texto "Acesso negado") e por teste automatizado do
  guard.
- [x] Logout invalida sessão de verdade (sessão antiga não funciona). —
  Verificado em navegador real (cookies da sessão antiga reutilizados numa
  segunda aba não dão acesso) e por teste de integração (`revokeSession`/
  `findValidSession`).
- [x] CPF nunca em claro no banco nem em logs; `cpf_hash` é determinístico e
  o pepper vem de env. — Já garantido desde o INC-002 (`cpf-hash.test.ts`);
  nenhum código novo deste INC loga ou persiste CPF em claro.
- [x] Toggles de consentimento persistem com timestamp. — Campo novo
  (`*ChangedAt`), só carimbado quando o valor muda de fato; coberto por
  teste de integração.

### Pendências / dívidas técnicas criadas

- **Storage de foto é mock local** (combinado com Pedro) — R2 real fica para
  um INC futuro; só trocar a implementação atrás de `MediaStorage`, sem
  tocar schema nem chamadores.
- **Design visual é placeholder** (zinc/black-white, shadcn default) — achei
  no repo, sem tocar, o `docs/06-Design/design-system.md` (ainda "a
  preencher") e o `INC-003.5-fundacao-design.md` já rascunhados para
  aplicar identidade visual retroativamente às telas deste INC. Não é
  pendência deste INC, é o próximo passo natural.
- **Papel `manager` não tem tela própria ainda** — só `admin` acessa o
  painel neste INC (o critério de aceite só pede isso); acesso intermediário
  de gestor fica para quando alguma feature exigir.
- **Rate limit é por conta, não por IP** — suficiente para o critério de
  aceite (trava a conta após tentativas), mas não impede um atacante de
  tentar CPFs diferentes rapidamente do mesmo IP. Sinalizo caso vire
  requisito explícito depois.
- **Anonimização de dados de desligados** (24 meses) continua não
  implementada — já era pendência explícita para o INC-013 (LGPD doc), não
  deste INC.
