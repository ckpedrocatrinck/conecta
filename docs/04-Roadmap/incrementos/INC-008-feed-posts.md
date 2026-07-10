# INC-008 — Feed: posts estruturados

**Status:** ⬜ Não iniciado
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
_(preencher)_
