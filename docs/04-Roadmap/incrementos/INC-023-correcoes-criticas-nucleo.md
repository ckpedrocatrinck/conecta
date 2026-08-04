# INC-023 — Correções críticas do núcleo jurídico (reabertura de pendência + agendamento)

**Status:** ⬜ Não iniciado
**Fase:** correção (pré-piloto)
**Origem:** teste manual real de 2026-08-04 (Pedro). Dois critérios já documentados, nunca verificados/confirmados:
- INC-005, escopo item 4 / critério "Pendência reaberta por versão material aparece para quem já tinha confirmado" (checkbox nunca marcado).
- INC-012.5, Bloco A, item A2-1 (status do INC inteiro é "não iniciado" — bate com o bug reproduzido hoje).

## Objetivo
Restaurar dois comportamentos que atacam diretamente o núcleo jurídico do produto: (1) editar um comunicado publicado com "mudança material" deve reabrir a pendência de quem já confirmou ciência; (2) comunicado agendado deve publicar automaticamente no horário marcado.

## Escopo

### Parte 1 — Reabertura de pendência por mudança material
- Diagnosticar por que marcar "mudança material" ao editar um comunicado publicado (`isMaterialChange`, gravado desde o INC-004) não reabre a pendência de quem já confirmou ciência — verificar se o consumo dessa flag do lado da leitura/ack (INC-005) nunca foi implementado, ou foi e regrediu.
- Implementar/corrigir: ao publicar uma versão de mudança material de um comunicado `requires_ack`, todo usuário com `AnnouncementAck` numa versão anterior do mesmo comunicado volta a aparecer como pendente, com o aviso "este comunicado foi atualizado" (já especificado no INC-005, item 4).
- Não apagar nem alterar acks antigos — a prova histórica permanece íntegra; a reabertura afeta o que conta como "pendente hoje", não o passado.

### Parte 2 — Agendamento não publica (A2-1)
- O middleware bloqueia `/api/cron/publish-announcements` antes do handler avaliar o `CRON_SECRET`, então o sweep (`runScheduledAnnouncementSweep`, já implementado desde o INC-004) nunca roda via cron.
- Excluir `/api/cron/*` do matcher do middleware (ou curto-circuitar a autenticação de sessão antes dele), deixando o Bearer-secret do próprio handler como única porta de entrada.
- Aplicar a mesma correção a `/api/cron/anonymize-users` (INC-013) — mesma causa, mesmo remédio.

## Critérios de aceite
- [ ] Publicar comunicado `requires_ack`; colaborador A confirma ciência; admin edita com "mudança material" e republica → colaborador A volta a aparecer no painel de pendências e vê o aviso de atualização + botão de ciência de novo.
- [ ] Colaborador B, que nunca confirmou, continua pendente normalmente (sem regressão no caminho que já funcionava).
- [ ] `GET /api/cron/publish-announcements` com `Authorization: Bearer <CRON_SECRET>` correto publica um comunicado agendado com `publishAt` no passado — verificado via HTTP real.
- [ ] O mesmo endpoint sem header, ou com secret errado, continua respondendo 401.
- [ ] `/api/cron/anonymize-users` com o mesmo tratamento e o mesmo teste de 401.
- [ ] `npm run lint && npm run typecheck && npm run test && npm run build` verdes.

## Como testar manualmente (Pedro, antes de aceitar)
1. Comunicado `requires_ack` → ack → edição material → republicar. Confirmar reabertura no painel de pendências e na tela do colaborador.
2. Agendar comunicado para poucos minutos no futuro, chamar o endpoint do cron manualmente com o Bearer correto. Confirmar publicação automática.

## Registro de conclusão
_(preencher)_
