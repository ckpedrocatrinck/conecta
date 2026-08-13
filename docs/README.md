# Projeto Conecta — Documentação Central

> Plataforma de comunicação interna e engajamento para empresas com operação distribuída em filiais, nascida da substituição do portal legado na Rede Vale Verde (piloto).

**Dono do projeto:** Pedro Catrinck
**Última atualização:** 2026-08-13
**Status geral:** 🔄 Pré-piloto — núcleo implementado e testado (360 testes verdes), sem usuário real ainda. Ver `README.md` da raiz (seção "Status") para o que falta antes do go-live.

Este arquivo é o **mapa de navegação do vault** — para quem vai ler a documentação, não a vitrine do projeto. Quem chega de fora deve começar pelo `README.md` da raiz do repositório; este arquivo é o próximo passo, para quem quer entender como as decisões foram tomadas e onde encontrar cada uma.

---

## Como este vault funciona

Este vault é a **fonte única de verdade** do projeto — em conflito entre código e documentação, a documentação vence, e o conflito é reportado, não resolvido em silêncio (`CLAUDE.md`, regra de fonte de verdade).

1. **Nada é implementado sem estar documentado aqui antes.** O agente de código lê este vault antes de qualquer incremento.
2. **Toda decisão de arquitetura vira ADR** em `02-Arquitetura/ADR/`. ADRs têm status (Proposto → Aceito → Substituído) e nunca são apagados — mesmo substituído, o ADR permanece como registro histórico da decisão e do porquê ela mudou.
3. **Todo trabalho de implementação é um INC** (incremento) em `04-Roadmap/incrementos/`. Um INC só é marcado ✅ após QA manual e merge (`00-Processo/fluxo-de-trabalho.md`).
4. **Decisões pendentes** ficam em `05-Decisoes-Pendentes.md` até serem resolvidas e promovidas a ADR ou spec.
5. **Auditorias** (`00-Processo/`) são revisões pontuais, somente-leitura, com achados datados e classificados por severidade — são um retrato de um momento, não atualizadas depois; se um achado foi corrigido, a correção aparece no INC ou ADR relevante, não editando a auditoria antiga.

## Mapa do vault

| Pasta | Conteúdo |
|---|---|
| `00-Processo/` | Convenções de git, fluxo de trabalho, boas práticas do agente de código, auditorias datadas |
| `01-Produto/` | Visão, tese, personas, escopo do MVP, o que ficou de fora |
| `02-Arquitetura/` | ADRs, modelo de dados, stack, infraestrutura, rotação de pepper |
| `03-LGPD/` | Bases legais, requisitos técnicos de privacidade (minuta — ver ressalva no README da raiz) |
| `04-Roadmap/` | Fases do projeto e um arquivo por incremento (`incrementos/INC-NNN-*.md`), com escopo, critérios de aceite e relatório de entrega |
| `05-Decisoes-Pendentes.md` | Perguntas abertas que bloqueiam ou moldam o projeto, numeradas (DP-NN) |
| `06-Design/` | Design system, tokens e capturas de tela usadas na vitrine |

## Convenção de status

- ⬜ Não iniciado
- 🔄 Em andamento
- 🟡 Código completo, mas com critério de aceite pendente de verificação externa (ex.: teste em device real, autorização do Pedro) — **não é o mesmo que ✅**
- 🔍 Em revisão (agente entregou, aguardando verificação)
- ✅ Concluído (revisado, commitado, branch mergeada)
- ⛔ Bloqueado (ver nota no próprio arquivo)

## ADRs — decisões de arquitetura aceitas

12 decisões aceitas (`ADR-001` a `ADR-012`), todas em `02-Arquitetura/ADR/`. `ADR-000` é o arquivo-modelo (template), não uma decisão. Nenhum ADR foi rejeitado ou substituído até aqui — apenas `ADR-005` recebeu uma emenda parcial (ver nota abaixo).

| ADR | Título | Status |
|---|---|---|
| 001 | Comunicado é entidade nativa versionada, nunca imagem | Aceito |
| 002 | PWA mobile-first, sem app nativo no MVP | Aceito |
| 003 | Multi-tenant por schema compartilhado desde o dia 1 | Aceito |
| 004 | Templates visuais no MVP; IA como camada plugável de fase 2 | Aceito |
| 005 | Stack: Next.js + TypeScript + PostgreSQL + Prisma | Aceito — parte de infraestrutura substituída pelo ADR-011 (ver emenda no próprio arquivo) |
| 006 | Ciclo de vida do usuário e autenticação por CPF | Aceito |
| 007 | Sessão: JWT do Auth.js com revogação verificada em banco | Aceito |
| 008 | Migrações manuais para tabelas com colunas GENERATED (search_vector) | Aceito |
| 009 | Arquitetura de navegação por papel | Aceito |
| 010 | Resolução de tenant por path na URL (`/empresa`) | Aceito |
| 011 | Infraestrutura e Implantação: VPS único no Brasil | Aceito |
| 012 | Repositório público com desvinculação total de empresa real | Aceito (2026-08-12) |

## Ordem de leitura sugerida

1. `README.md` da raiz (vitrine — problema, tese, como rodar)
2. Este arquivo
3. `01-Produto/visao-e-tese.md`
4. `01-Produto/escopo-mvp.md`
5. `02-Arquitetura/stack.md` e `02-Arquitetura/modelo-de-dados.md`
6. Os 12 ADRs Aceitos, na ordem da tabela acima
7. `03-LGPD/lgpd-requisitos-tecnicos.md`
8. O INC específico que você quer entender, em `04-Roadmap/incrementos/`
