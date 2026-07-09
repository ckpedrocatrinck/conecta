# INC-007 — Cobrança, exportação CSV e AuditLog

**Status:** ⬜ Não iniciado
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
- [ ] CSV abre corretamente no Excel pt-BR (separador/encoding testados).
- [ ] Toda ação listada gera entrada no AuditLog com actor correto.
- [ ] Cobrança não duplica notificação para quem já confirmou entre o clique e o processamento.

## Registro de conclusão
_(preencher)_
