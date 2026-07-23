# INC-015 — Clube de Benefícios / Parceiros

**Status:** ✅ Concluído (2026-07-23)
**Fase:** feature pré-piloto (necessária para paridade com a portal legado no go-live)
**Depende de:** INC-014 (tenant por path) na main; padrão de CRUD admin dos INCs anteriores
**Origem:** o Vale Verde usa e valoriza a aba de benefícios da portal legado; ausência no go-live seria retrocesso visível de adoção (decisão de Pedro).

## O que é
Área onde a EMPRESA-CLIENTE (tenant) cadastra e divulga os benefícios que ELA
oferece aos SEUS funcionários (desconto em academia, farmácia, cartão bônus,
escola, etc.). O Conecta fornece o espaço; o conteúdo é de cada tenant — como
comunicados, vagas e aniversariantes. NÃO é benefício do Conecta; é da empresa
aos seus empregados. O admin/gestor configura tudo.

## Escopo do MVP (decisões travadas)
- **Só TEXTO nesta versão. SEM logo/imagem.** Logo depende do R2 real (hoje mock/
  dívida aprovada) — fica para fase 2, quando o R2 for ativado (necessário também
  para fotos em produção). Campo `logo_url` já entra no schema (nulo), para a
  fase 2 não exigir migration. Isto evita abrir a caixa do R2 no caminho crítico
  do piloto.
- Multi-tenant nativo (tenant_id + RLS, como tudo).
- "Melhor que a portal legado": mesmo conteúdo, visual do Conecta (accordion limpo por
  categoria), SEM os defeitos da portal legado (capitalização quebrada tipo "SAúDE",
  visual pesado). Categorias com capitalização correta.

## Modelo de dados
```
Benefit
  id, tenant_id
  category            -- enum: saude | lazer | educacao | alimentacao | outros
                      --       (rótulos exibidos: Saúde, Lazer, Educação, ...;
                      --       minúsculo, alinhado à convenção dos outros enums)
  partner_name        -- "Academia Fit"
  title               -- "30% de desconto na mensalidade"
  description         -- detalhes / como usar / condições (texto PLANO, sem editor rico)
  location?           -- endereço / como chegar (opcional)
  contact?            -- telefone / site / instrução de contato (opcional)
  logo_url?           -- NULO no MVP (fase 2 / R2)
  active (bool)       -- desativar sem apagar
  sort_order?         -- ordenação dentro da categoria
  created_by, created_at, updated_at
```
- RLS forçada + tenant_id, como todas as tabelas de domínio.
- Migration manual (ADR-008).

## Telas
### Admin/Gestor (desktop) — CRUD
- Listar benefícios agrupados por categoria.
- Criar / editar (todos os campos acima), ativar/desativar, ordenar.
- Confirmação destrutiva ao remover (padrão do INC-012.5).
- Feedback de sucesso/erro em toda ação (padrão do INC-012.5).
- Item no header admin (o header comporta; ver ADR-009).
- Autorização: admin e gestor podem gerenciar (confirmar regra de papel; gestor
  gerencia? ou só admin? — decidir no plano).

### Colaborador (mobile 360px) — leitura
- Lista de benefícios ativos, agrupados por categoria (accordion limpo, padrão
  visual Conecta).
- Cada item: parceiro, benefício (título), descrição/como usar, local, contato.
- Só benefícios `active=true`.
- **Navegação (DECIDIDO — revisado 2026-07-23):** Benefícios entra como **5º item
  fixo do bottom nav do colaborador** (Início · Comunicados · Vagas · Benefícios ·
  Perfil). É a **exceção consciente** à recomendação inicial (que evitava o 5º
  ícone pelo aperto em 360px): o Pedro optou por **acesso permanente** por ser
  feature de uso frequente, aceitando o aperto visual. Dano minimizado no
  componente `BottomNav` — `px-1`, label 0.625rem e truncamento de segurança; a
  altura do alvo permanece `min-h-12` (48px) e cada item ocupa ~72px de largura a
  360px, então o alvo de toque continua ≥48px. Ícone: `Gift` (presente),
  consistente com o card da Início. Permanece também: rota dedicada
  `/{slug}/beneficios` (accordion) e o **card-chamada na Início** (convite enxuto
  "Clube de Benefícios — descontos e vantagens da empresa" + "Ver todos", NÃO a
  lista) — funções distintas: o card serve **descoberta**, o ícone serve **acesso
  intencional**. Admin: item **"Benefícios"** no header (após Vagas). **ADR-009
  atualizado** para registrar os 5 itens do bottom nav e a justificativa (ainda
  dentro do máximo de 5 previsto no próprio ADR).

## Fora de escopo (explícito)
- Logo/imagem dos parceiros → fase 2 (R2). `logo_url` fica nulo por ora.
- Benefícios com regras complexas (cupons, resgate, integração com parceiro) →
  futuro. MVP é vitrine informativa (o que é, como usar).
- Métricas de uso de benefício → futuro.

## Critérios de aceite
- [x] Admin cadastra, edita, ativa/desativa e ordena benefícios por categoria —
      CRUD em `admin/beneficios` (autorização `requireAdmin`; ordenação por
      `sort_order` dentro da categoria).
- [x] Colaborador vê os benefícios ativos por categoria, no visual Conecta (sem
      defeitos da portal legado), no mobile 360px — `/{slug}/beneficios` (accordion),
      capitalização correta via rótulos centralizados.
- [x] Multi-tenant: benefícios de um tenant nunca aparecem noutro (RLS + teste) —
      RLS forçada na migration; `tenant-isolation.test.ts` + `benefits.test.ts`
      (findMany sem where, by-ID, WITH CHECK).
- [x] Ações admin com feedback e confirmação destrutiva — feedback `?salvo/?ok/?erro`
      em toda ação; `ConfirmDialog` destrutivo na exclusão (padrão INC-012.5).
- [x] Navegação decidida — Benefícios como 5º item do bottom nav (decisão
      consciente do Pedro), card-chamada de descoberta na Início, item no header
      admin; ADR-009 atualizado.
- [x] Sem dependência do R2 — `logo_url` nulo, nenhum upload; storage intocado.
- [x] lint+typecheck+test verdes (227 testes); QA visual do Pedro aprovado
      (admin desktop + colaborador mobile 360px + isolamento entre os 2 tenants).

## Registro de conclusão
**Concluído em 2026-07-23**, branch `inc-015-clube-de-beneficios`, merge `--no-ff`
na main. Entregue em 3 blocos:
1. **Migration + entidade + isolamento** — tabela `benefits` (enum
   `BenefitCategory` minúsculo, `logo_url` nulo p/ fase 2), migration manual
   (ADR-008) com GRANT mínimo + RLS forçada, repositório, rótulos pt-BR
   centralizados, fixtures e testes de isolamento/CRUD/active/ordenação.
2. **CRUD admin** — lista por categoria, criar/editar, ativar-desativar, excluir
   com confirmação destrutiva, feedback + auditoria, item no header admin.
3. **Colaborador + navegação** — `/{slug}/beneficios` (accordion), card-chamada
   na Início e Benefícios como 5º item do bottom nav (ADR-009 atualizado).

Achado colateral corrigido no caminho (fora do escopo do INC-015, commit
`fix(INC-014)` à parte): o `middleware.ts` estava na raiz do projeto, mas com
diretório `src/` o Next 16 só carrega `src/middleware.ts` — a raiz era ignorada,
deixando toda rota autenticada `/{slug}/**` sem o header `x-tenant-slug` e
renderizando "Empresa não encontrada". Movido para `src/middleware.ts`.

**Dívidas/pendências:** (a) logo dos parceiros → fase 2 (R2), campo já existe
nulo; (b) categorias fixas — evolução para tabela por-tenant fica para fase 2 se
algum cliente pedir; (c) Next 16 marca a convenção `middleware` como deprecada em
favor de `proxy` — migração futura (ver ADR-009 / memória do projeto).
