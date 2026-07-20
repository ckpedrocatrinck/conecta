# INC-014 — Resolução de tenant por path (`/{slug}`)

**Status:** ⬜ Não iniciado
**Fase:** fundação (antes do hardening INC-013)
**Depende de:** ADR-010 (aceito)
**Natureza:** mudança de FUNDAÇÃO — toca middleware, auth, roteamento de todas as rotas, navegação. Risco de regressão em auth/isolamento. Sem pressa, teste de isolamento reforçado, blocos revisáveis.

## Objetivo
Migrar a resolução de tenant do seletor de empresa no login para o path da URL
(`conecta.com.br/{slug}`), conforme ADR-010, SEM enfraquecer o isolamento entre
tenants que a auditoria confirmou sólido.

## Princípio-mestre
A barreira de isolamento (RLS + withTenant + set_config) NÃO muda. Só muda a
FONTE do tenantId: da lista no login para o path da URL. Se em algum momento a
mudança parecer exigir tocar as policies de RLS ou o withTenant → PARE e
pergunte (não deveria ser necessário).

## Escopo em blocos revisáveis

### BLOCO 1 — Resolução de tenant no middleware (sem migrar rotas ainda)
- Middleware extrai o 1º segmento do path como slug candidato.
- Resolve slug → tenantId (com cache; slugs estáveis). Slug inexistente →
  página 404 "empresa não encontrada", sem vazar lista de tenants.
- Propaga tenantId resolvido para o request (header interno/contexto).
- CHECKPOINT: testes de resolução (slug válido resolve, inválido → 404 sem vazar).

### BLOCO 2 — Login tenant-scoped (revoga seletor de empresa)
- Login vive em /{slug}/login. Remove o seletor de empresa do formulário.
- authorize recebe tenantId da URL/contexto, não do form. CPF+senha idênticos.
- Busca de usuário por cpf_hash escopada ao tenant da URL.
- Sessão passa a carregar/validar o tenantId (para o Bloco 3).
- CHECKPOINT: login funciona por URL; testes de auth verdes.

### BLOCO 3 — Vínculo sessão↔tenant + caso cross-tenant (o mais crítico)
- Sessão validada contra o tenant da URL em TODA request.
- Sessão do tenant A em URL do tenant B → redireciona a /{slug-B}/login,
  NÃO aceita a sessão do A no B (decisão ADR-010).
- Cookie de sessão: validação server-side do vínculo (tabela Session já existe).
- TESTES DE ISOLAMENTO REFORÇADO (obrigatório, o coração do INC):
  - sessão do tenant A rejeitada em URL do tenant B (cai no login do B);
  - slug inexistente → 404 sem vazar;
  - tenant da URL governa o set_config, não valor do cliente;
  - os testes de RLS existentes (tenant-isolation.test.ts) continuam verdes.
- CHECKPOINT: revisão minha + QA do fluxo cross-tenant antes de migrar rotas.

### BLOCO 4 — Migração das rotas para sob /{slug}
- Route group (app) passa para sob o segmento de slug: /{slug}/comunicados,
  /{slug}/admin/…, etc.
- Navegação (ADR-009) monta links já com o slug corrente. Sem mudança de
  papel/autorização — só o prefixo.
- Redirects (pós-login, onboarding), links absolutos, e PWA/service worker
  consideram o slug (start_url do manifest por tenant — avaliar).
- ATENÇÃO service worker: lembrar do INC-012 (SW deu muito trabalho). O start_url
  e o escopo do SW mudam com o slug — testar instalação/PWA por tenant.
- CHECKPOINT: QA de navegação completa (todas as rotas sob slug funcionam).

## Fora de escopo
- Site institucional em conecta.com.br (raiz) — projeto próprio, é a vitrine.
- Domínio customizado por tenant (portal.cliente.com.br) — fase enterprise.
- Personalização visual por tenant a partir da URL — futuro (o slug habilita,
  mas a personalização é outro trabalho).

## Critérios de aceite
- [ ] conecta.com.br/{slug} resolve o tenant correto; slug inválido → 404 digno.
- [ ] Login por URL funciona; seletor de empresa removido.
- [ ] Sessão do tenant A NUNCA acessa dados do tenant B (cai no login do B).
- [ ] Testes de isolamento reforçado verdes + os de RLS existentes intactos.
- [ ] Todas as rotas migradas para /{slug}; navegação e redirects corretos.
- [ ] PWA/service worker funciona por tenant (instalação testada).
- [ ] Nenhuma regressão: lint+typecheck+test verdes; QA de login e isolamento.

## Registro de conclusão
_(preencher — roadmap + registro no mesmo commit)_
