# INC-008 — Feed: posts estruturados

**Status:** ✅ Concluído
**Fase:** 3 — Engajamento
**Depende de:** INC-003

## Objetivo
RH publica reconhecimentos/tempo de casa/promoções como dados estruturados; colaborador tem um feed vivo.

## Escopo
1. CRUD admin de posts: tipo (recognition | tenure | promotion | general), título, texto opcional, data do evento, pessoas marcadas (busca no cadastro), fotos (upload múltiplo), filial associada opcional.
2. Feed do colaborador na home: cronológico, misturando tipos, com paginação infinita leve.
3. Pessoa marcada respeita `photo/consent` — quem revogou consentimento de foto aparece só com nome, e o admin é avisado no momento da marcação.
4. Card do feed ainda com layout básico (o visual final por template vem no INC-009).

## Critérios de aceite
- [ ] Marcar pessoas puxa do cadastro real (sem digitar nome livre).
- [ ] Upload de 5 fotos em 4G simulado funciona com feedback de progresso.
- [ ] Feed em 360px sem scroll horizontal.

## Registro de conclusão
- **Concluído em:** 2026-07-13
- **Branch:** inc-008-feed-posts
- **Commit de merge:** 550a7f8
- **QA validado por Pedro:** consentimento de foto testado no navegador —
  colaborador sem consentimento aparece só com nome; ao ligar o consentimento
  no perfil, a foto surge no card sem reeditar o post (prova de que a checagem
  é na renderização, não snapshot).
- **Notas:** saneamento de histórico de migração (ADR-008) feito em branch
  separada antes deste merge. Erro de drop de tabelas durante a implementação
  foi detectado e revertido pelo Claude Code sem perda.
