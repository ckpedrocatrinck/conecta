# Stack Técnica

> Status: **Proposta** — vira Aceita quando o ADR-005 for aceito por Pedro. O Claude Code não inicia o INC-001 antes disso.

## Aplicação

| Camada | Escolha | Justificativa curta |
|---|---|---|
| Framework | **Next.js 15+ (App Router, TypeScript)** | Full-stack em um repo; SSR bom para rede ruim; ecossistema que o Claude Code domina; PWA maduro |
| UI | **Tailwind CSS + shadcn/ui** | Velocidade com consistência visual; mobile-first natural |
| Banco | **PostgreSQL** | Row-Level Security nativa para multi-tenant (ADR-003); JSONB para flexibilidade de posts |
| ORM | **Prisma** | Migrations versionadas (auditável), tipagem ponta a ponta |
| Auth | **Auth.js (credentials) + sessões em banco** | Login por matrícula+senha sem depender de e-mail; controle total LGPD |
| Push | **Web Push (VAPID)** via service worker do PWA | Sem custo, padrão aberto; fallback = badge in-app |
| Storage de mídia | **S3-compatível (Cloudflare R2)** | Fotos de posts/perfil; barato, sem egress caro |
| Geração de cards | **Templates HTML/CSS renderizados** (satori/og-image ou screenshot server-side) | Custo zero por card (ADR-004) |
| E-mail transacional | Nenhum no MVP | Colaborador não tem e-mail corporativo; reavaliar na fase 2 |

## Infraestrutura

| Item | Escolha |
|---|---|
| Hospedagem app | Vercel (dev/piloto) — reavaliar custo em produção multi-cliente |
| Banco gerenciado | Neon ou Supabase (Postgres gerenciado, tier gratuito no piloto) |
| Região | **Preferir região no Brasil ou us-east** com documentação de transferência internacional no aviso de privacidade (ver LGPD) |
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
