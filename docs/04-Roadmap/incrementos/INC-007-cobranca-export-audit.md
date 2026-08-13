# INC-007 — Cobrança, exportação CSV e AuditLog

**Status:** ✅ Concluído
**Fase:** 2
**Depende de:** INC-006

## Objetivo
Fechar o ciclo probatório: cobrar pendentes e exportar evidência; ações administrativas auditadas.

## Escopo
1. Botão "Cobrar pendentes" por comunicado: cria notificação in-app (push real chega no INC-012; arquitetura de notificação já preparada com canal abstrato).
2. Export CSV do log de confirmações de um comunicado: colaborador, matrícula, filial, versão, hash, timestamp — nome de arquivo com número do CI e data.
3. Export registrado no `AuditLog` (quem exportou, quando).
4. `AuditLog` implementado para: publicar/editar/arquivar comunicado, importar CSV, mudar papel, exportar dados; tela de consulta simples para admin.

## Critérios de aceite
- [x] CSV abre corretamente no Excel pt-BR (separador/encoding testados) — `src/lib/csv/announcement-ack-export.ts`, `tests/integration/announcement-ack-export.test.ts`.
- [x] Toda ação listada gera entrada no AuditLog com actor correto — `src/lib/repositories/audit-log.repository.ts`, `tests/integration/audit-log.test.ts`.
- [x] Cobrança não duplica notificação para quem já confirmou entre o clique e o processamento — `src/lib/announcements/remind-pending.ts`, `tests/integration/remind-pending.test.ts`.

## Registro de conclusão

- **Data:** 2026-07-13 (marcação retroativa — implementação já estava mergeada em `main`, doc não tinha sido fechada)
- **Branch:** `inc-007-cobranca-export-audit`
- **Commit:** `807babd` (`feat(INC-007): cobranca de pendentes, export CSV e AuditLog`)
- **CI:** cobertura via `tests/integration/announcement-ack-export.test.ts`, `tests/integration/audit-log.test.ts` e `tests/integration/remind-pending.test.ts`.
