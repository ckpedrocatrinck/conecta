# Stack Técnica

> **Nota de infraestrutura (ADR-011):** as escolhas de storage, hospedagem, banco e região abaixo foram atualizadas pela decisão do ADR-011 (VPS único no Brasil, MinIO no lugar de R2). Onde houver divergência, o ADR-011 prevalece.

## Aplicação

| Camada | Escolha | Justificativa curta |
|---|---|---|
| Framework | **Next.js 15+ (App Router, TypeScript)** | Full-stack em um repo; SSR bom para rede ruim; ecossistema que o Claude Code domina; PWA maduro |
| UI | **Tailwind CSS + shadcn/ui** | Velocidade com consistência visual; mobile-first natural |
| Banco | **PostgreSQL** | Row-Level Security nativa para multi-tenant (ADR-003); JSONB para flexibilidade de posts |
| ORM | **Prisma** | Migrations versionadas (auditável), tipagem ponta a ponta |
| Auth | **Auth.js (credentials) + sessões em banco** | Login por matrícula+senha sem depender de e-mail; controle total LGPD |
| Push | **Web Push (VAPID)** via service worker do PWA | Sem custo, padrão aberto; fallback = badge in-app |
| Storage de mídia | **MinIO** (S3-compatível, auto-hospedado no VPS) — portável para R2/S3 pela interface `MediaStorage`. Ver **ADR-011**. | Fotos de posts/perfil; dado no Brasil, sem transferência internacional; sem custo de serviço externo no piloto |
| Geração de cards | **Templates HTML/CSS renderizados** (satori/og-image ou screenshot server-side) | Custo zero por card (ADR-004) |
| E-mail transacional | Nenhum no MVP | Colaborador não tem e-mail corporativo; reavaliar na fase 2 |

> **Nota de versão (INC-002):** Prisma fixado em **6.x**, não a v7 (instalada por padrão em jul/2026). A v7 remove `datasource.url` do `schema.prisma` em favor de `prisma.config.ts` + driver adapters — paradigma não validado e incompatível de cara com o desenho de RLS do INC-002 (duas roles Postgres — owner para migrate/seed, `conecta_app` para runtime — cada uma com uma connection string diferente via override no client). Reavaliar a migração para Prisma 7 num INC dedicado, não de passagem em outro INC.

> **Nota de versão (INC-003):** `next-auth` (Auth.js) fixado em **`5.0.0-beta.31`** (versão exata, sem `^`) — não existe release estável da v5 ainda (`latest` do pacote aponta para a v4, sem o helper `auth()`/App Router de primeira classe que o INC-003 usa). Fixado exato, não com `^`, porque é software beta: um patch de beta pode trazer breaking change sem seguir semver estrito. Reavaliar o pin quando a v5 estabilizar (ou o Credentials provider passar a suportar sessão "database strategy" — ver ADR-007).

> **Nota de migrações (INC-002/003/007):** toda migração que cria ou altera tabela é escrita/ajustada à mão e aplicada com `prisma migrate deploy`, nunca `prisma migrate dev` — o diff automático do Prisma tenta alterar `announcement_versions.search_vector` (coluna `GENERATED`, fora do schema.prisma) de um jeito que o Postgres recusa. Procedimento completo em ADR-008.

## Infraestrutura

| Item | Escolha |
|---|---|
| Hospedagem app | **Produção: VPS Hostinger, São Paulo** (Docker Compose). Vercel apenas para demo/homologação (Fase 2). Ver **ADR-011**. |
| Banco | **PostgreSQL no próprio VPS** (Docker, mesmo Compose da app). Neon/Supabase descartados como caminho de produção. Ver **ADR-011**. |
| Região | **São Paulo, Brasil** — app, banco e mídia no país, sem transferência internacional (simplifica o aviso de privacidade). Ver **ADR-011**. |
| CI | GitHub Actions: lint + typecheck + testes em todo push de branch de INC |
| Monitoramento | Sentry (erros) + logs da plataforma no MVP |

## Padrões de código

- TypeScript estrito (`strict: true`), sem `any` não justificado.
- Código, nomes e comentários em **inglês**; strings de interface em **pt-BR** centralizadas (preparar i18n barato).
- Testes: unitários para lógica de domínio (numeração de CI, versionamento, pendências) e de integração para as rotas críticas de confirmação de leitura. Não perseguir cobertura total no MVP; perseguir cobertura do **núcleo jurídico**.
- Datas sempre em UTC no banco; conversão para `America/Sao_Paulo` na borda de exibição.

## O que fica explicitamente fora da stack do MVP

- Filas/workers dedicados (agendamento de publicação resolve com cron da plataforma).
- Redis/cache distribuído.
- Microsserviços de qualquer espécie — monolito modular.
- SDK de IA — só entra na fase 2, atrás de interface própria (`ContentAssistant`) para trocar de fornecedor sem dor.
