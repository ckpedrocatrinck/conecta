# INC-004 — Comunicados: CRUD admin + versionamento

**Status:** ⬜ Não iniciado
**Fase:** 2 — Núcleo jurídico
**Depende de:** INC-003
**ADRs relevantes:** 001

## Objetivo
Admin cria, agenda e publica comunicados estruturados com numeração automática e versionamento imutável.

## Escopo
1. CRUD no painel: título, corpo rich text (editor simples: negrito, itálico, listas, links), categoria, criticidade, público-alvo (todos | filiais), anexos.
2. Estados: draft → scheduled → published → archived. Número `CI NN/AAAA` atribuído na publicação (sequência por tenant+ano, à prova de corrida).
3. Edição pós-publicação = nova versão com `content_hash`; marcar "mudança material" reabre pendências (só se `requires_ack`).
4. Agendamento de publicação (cron da plataforma).
5. Busca full-text pt-BR na listagem admin.

## Critérios de aceite
- [ ] Dois admins publicando simultaneamente não geram número duplicado (teste).
- [ ] Editar comunicado publicado gera versão nova; hash muda; versão antiga permanece íntegra.
- [ ] Rascunho não consome número.
- [ ] Público-alvo por filial restringe visibilidade (validar com usuários de filiais diferentes do seed).

## Registro de conclusão
_(preencher)_
