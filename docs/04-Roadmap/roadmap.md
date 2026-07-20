# Roadmap

## Fases

| Fase | Objetivo | Critério de saída |
|---|---|---|
| **0. Formalização** | Acordo com a diretoria do Vale Verde (IP do fundador + cliente-piloto); aceite dos ADRs | ✅ **Concluída (2026-07-09):** IP aprovado pela diretoria; ADRs 001-006 Aceitos |
| **1. Fundação técnica** | INC-001 a INC-003 | App autenticado, multi-tenant, com cadastro importado e testes de isolamento passando |
| **2. Núcleo jurídico** | INC-004 a INC-007 | Fluxo completo: publicar → confirmar → auditar → exportar |
| **3. Engajamento** | INC-008 a INC-010 | Feed com templates, aniversariantes, reações |
| **4. Vagas + PWA completo** | INC-011 a INC-012 | Candidatura em 1 toque; app instalável com push |
| **5. Piloto** | Go-live no Vale Verde | Métricas de `01-Produto/visao-e-tese.md` medidas por 90 dias |

## Tabela de incrementos

| INC | Nome | Fase | Status | Depende de |
|---|---|---|---|---|
| 001 | Setup do repositório e esqueleto | 1 | ✅ | ADRs aceitos |
| 002 | Schema, migrations e multi-tenancy | 1 | ✅ | 001 |
| 003 | Autenticação, papéis e cadastro (import CSV) | 1 | ✅ | 002 |
| 003.5 | Fundação de design (tokens + componentes-base) | 1 | ✅ | 003 |
| 004 | Comunicados: CRUD admin + versionamento | 2 | ✅ | 003.5 |
| 005 | Comunicados: leitura e confirmação de ciência | 2 | ✅ | 004 |
| 006 | Painel de pendências + visão do gestor | 2 | ✅ | 005 |
| 007 | Cobrança, exportação CSV e AuditLog | 2 | ✅ | 006 |
| 008 | Feed: posts estruturados (CRUD + timeline) | 3 | ✅ | 003 |
| 008.5 | Navegação global (bottom nav + header admin) | transversal (3/4) | ✅ | 008 |
| 009 | Templates visuais de cards | 3 | ✅ | 008 |
| 010 | Aniversariantes + reações + opt-outs de perfil | 3 | ✅ | 008 |
| 011 | Vagas internas + candidatura | 4 | ✅ | 003 |
| 012 | PWA completo: manifest, offline, Web Push | 4 | 🟡 código completo e mergeado na main (`e01df13`, 2026-07-16) — aguarda medição real de push em iPhone antes de fechar ✅ | 005 (push de cobrança) |
| 012.5 | Correções pré-piloto (Balde 1 das auditorias) | transversal (entre 4 e 5) | ✅ | 012 |
| 013.5 | Redesenho visual (DP-13 navegação + DP-14 visual) | polimento (entre 4 e 5) | ✅ | 012.5 |
| 014 | Resolução de tenant por path (`/{slug}`) | fundação (antes do hardening) | ✅ | ADR-010 |
| 013 | Hardening pré-piloto: LGPD checklist, backup/restore, seeds reais | 5 | ⬜ | todos, 014 |

Observações:
- 008-011 podem rodar após a fase 2 em qualquer ordem; a ordem acima é a recomendada (engajamento antes de vagas para o go-live ter feed vivo).
- Cada INC tem arquivo próprio em `incrementos/` com escopo e critérios de aceite — o arquivo é o contrato com o Claude Code.
- Fase 1.5/2 do produto (ouvidoria, benefícios, IA, quiz) está em `01-Produto/fora-do-escopo-fase2.md` e ganhará INCs próprios quando especificada.
- INC-012.5 é transversal de correção (triagem das auditorias de 2026-07-16, "Balde 1") — não é uma feature nova de fase, roda entre o INC-012 e o polimento visual (DP-13/DP-14)/INC-013.
