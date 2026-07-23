# INC-013 — Hardening pré-piloto

**Status:** ⬜ Não iniciado
**Fase:** 5 — Piloto (o último INC de substância antes do go-live)
**Depende de:** todos os anteriores (INC-013.5 mergeado)

## Objetivo
Sistema pronto para dados reais de pessoas reais. NÃO é construir features — é
verificar, comprovar, blindar e preparar operação. A maioria dos controles LGPD
já foi construída nos INCs anteriores; aqui a gente PROVA (com evidência) o que
existe e CONSTRÓI só o que falta.

## Princípio de trabalho
Este INC tem natureza mista (verificação + construção pontual + operação). Por
isso, organizado em blocos, com o BLOCO A (auditoria de conformidade) primeiro —
ele revela o que realmente falta antes de construir, evitando construir o que já
existe.

---

## BLOCO A — Auditoria de conformidade LGPD (verificar e comprovar)
Percorrer `docs/03-LGPD/lgpd-requisitos-tecnicos.md` item a item. Para cada um:
marcar ✅ com EVIDÊNCIA (arquivo/linha/teste que comprova) ou ❌ com o gap exato.
NÃO corrigir aqui — só mapear. Saída: o checklist preenchido + lista de gaps reais.

Itens que provavelmente JÁ ESTÃO FEITOS (confirmar com evidência):
- TLS/HSTS (plataforma), senhas hash forte, CPF cpf_hash+pepper (ADR-006),
  sessões revogáveis (ADR-007), RLS por tenant + teste de isolamento (ADR-003,
  INC-002), AnnouncementAck imutável + triggers (INC-002/012.5), AuditLog de
  ações admin (INC-007), segredos fora do repo, consentimentos com registro
  (INC-003/008), aviso de privacidade no 1º login e perfil (INC-003/012.5),
  toggles de consentimento com efeito imediato (INC-003).

Itens que provavelmente FALTAM ou estão PARCIAIS (confirmar):
- Rate limit em login e endpoints de escrita (verificar se existe).
- Uploads: URLs de mídia assinadas/com token (fotos não podem ser públicas por
  URL adivinhável) — verificar como o R2 serve as fotos hoje.
- Anonimização de desligados após retenção (A3-1 da auditoria — sabidamente
  pendente; ver Bloco C).
- Tela "Meus dados" (titular vê o que o sistema sabe sobre ele) — verificar se
  existe ou é gap.
- Backups cifrados + teste de restore (ver Bloco D).

## BLOCO B — Hardening de segurança (construir o que o Bloco A apontar)
Escopo depende do Bloco A, mas provavelmente inclui:
- Rate limit em login e endpoints de escrita (se faltar).
- Headers de segurança: CSP básica, HSTS, X-Content-Type-Options, etc.
- URLs de mídia assinadas/tokenizadas se as fotos estiverem expostas.
- Qualquer gap de segurança que o Bloco A revelar.

## BLOCO C — Ciclo de vida do dado (anonimização)

### G1 — Anonimização de desligados (o maior item; desenho aprovado)
Executa o que o ADR-006 (linha 81 do modelo-de-dados) já definiu. NÃO é decisão
nova; é implementar o que estava planejado.

**Prazos (configurável por tenant, defaults propostos, a confirmar com jurídico):**
- Novo campo `Tenant.retentionMonths` (default 24) — dados pessoais gerais.
- Novo campo `Tenant.ackRetentionMonths` (default 60 = 5 anos) — registros de
  ciência, prazo prescricional trabalhista.
- Nota: nenhum dado será anonimizado nos primeiros ~24 meses do piloto (ninguém
  atinge o prazo no dia 1). Logo, o número final do jurídico pode vir DURANTE o
  piloto sem travar o go-live. Código com defaults destrava; config ajusta depois.

**O que vira pseudônimo (anonimização de um User desligado vencido):**
- `full_name` → "Colaborador Anonimizado #{id-curto}" (ou similar estável).
- `cpf_hash` → valor derivado não-reversível/nulo (perde a capacidade de buscar
  por CPF — correto, a pessoa não loga mais).
- `phone`, `email`, `photo_url`, `birth_date` → nulos.
- `registration_code` → mantém? (decisão: manter, é identificador interno não-PII
  forte; ou anonimizar por precaução — CONFIRMAR no plano).
- `anonymized_at` → timestamp do evento (o campo já existe no schema, nunca usado).
- **Preserva:** o vínculo dos `AnnouncementAck`/`AnnouncementRead` ao user
  pseudonimizado. A prova de ciência continua válida ("o colaborador [pseudônimo]
  confirmou o comunicado Y em tal data") — força probatória mantida SEM o dado
  pessoal. Os acks são imutáveis (não se toca neles; só o User que eles referenciam
  é anonimizado).

**Mecânica (automático com rede de segurança):**
- Job roda via o cron existente. Identifica Users com `status=inactive` +
  desligamento além de `retentionMonths` + ainda não anonimizados.
- **Modo dry-run** (flag): roda e REPORTA o que SERIA anonimizado (lista de ids)
  sem executar. Rede de segurança contra destruição irreversível de dado.
- Execução real: anonimiza, carimba `anonymized_at`, registra em AuditLog
  (`employee.anonymize`) cada anonimização. Idempotente (não re-anonimiza).
- O ack, sendo imutável, NÃO é tocado — só o User referenciado muda. Confirmar
  que anonimizar o User não viola o trigger de imutabilidade do ack (não deve:
  são tabelas diferentes; mas confirmar no plano).

**Determinar a data de desligamento:** hoje o desligamento é `status=inactive`.
Precisa de um `deactivated_at` para contar o prazo? Verificar se existe; se não,
adicionar (o prazo conta a partir do desligamento, não do `updated_at` genérico).

**Testes:**
- Dry-run lista os vencidos sem alterar nada.
- Execução anonimiza vencido (PII sobrescrita, `anonymized_at` setado), NÃO toca
  não-vencido, NÃO toca ativo.
- Ack do user anonimizado permanece íntegro e vinculado (prova preservada).
- Idempotência (rodar 2x não re-anonimiza).
- Anonimização não viola trigger de imutabilidade de ack/version/audit.

**Follow-ups do G1 (registrados, fora do escopo desta entrega):**
- **Purga do blob da foto no R2:** a anonimização anula `photoUrl` (a referência
  no banco), mas o arquivo físico da foto persistirá quando o storage real (R2)
  for ativado. Hoje o storage é mock (`LocalMediaStorage`, grava em `.local-media`,
  nunca servido — dívida aprovada, `media-storage.ts:53`), então **não bloqueia o
  piloto**. Vira **pendência LGPD obrigatória do INC de storage**: ao trocar o mock
  pelo R2, adicionar `delete(key)` à interface `MediaStorage` e chamá-lo na
  anonimização (`src/lib/users/anonymize-sweep.ts`). Anotado no código no ponto da
  troca (`media-storage.ts`).
- **Fase 2 (corte pós-`ackRetentionMonths`):** o G1 implementa só a fase 1 (24m);
  `ackRetentionMonths` (60m) é guardado como config mas **não há job de corte**
  pós-prescrição (o ack fica indefinidamente sob pseudônimo, e nunca é deletado).
  O desenho legal do "o que acontece aos 5 anos" depende do jurídico (DP-06) —
  documentado como TODO no ADR-006.

### Outros itens do Bloco C (menores, depois do G1)
- G2 aviso definitivo (jurídico), G7 já feito no Bloco B, G10 "Meus dados" acks
  do titular, G8 export por tenant (🔵 piloto), G9 ConsentEvent (🔵).

## BLOCO D — Operação (backup, restore, seed, runbook, métricas)
- Backup automático do banco + **teste de restore executado de verdade** em
  ambiente limpo, com log/print no vault. (Critério de aceite crítico.)
  Roteiro + template de evidência: `docs/00-Processo/runbook-teste-de-restore.md`.
- Seed de produção: import real de filiais + colaboradores do Vale Verde (com
  autorização formal — depende de você obter os dados reais e o aceite).
- Runbook de go-live: passo a passo de deploy, plano de rollback, canal de
  suporte (você) comunicado ao RH, o que fazer se o push não funcionar (plano B
  WhatsApp — depende do teste de iPhone do INC-012).
- Métricas do piloto: ativos/mês, taxa de confirmação em 7 dias, tempo de
  publicação→primeira ciência. Queries documentadas ou painel simples.

---

## Dependências externas (não são código — são suas)
- **Teste do push no iPhone** (INC-012, ainda 🟡): decide se o runbook precisa do
  plano B do WhatsApp. Fazer antes de fechar o Bloco D.
- **Prazos de retenção LGPD** (DP-06): confirmar com jurídico. Não trava o código
  (implementar configurável), trava a operação real.
- **Aviso de privacidade final** (substituir placeholder): entrada jurídica.
- **Dados reais + autorização do Vale Verde** para o seed de produção.
- **Merge da branch trustHost** + linhas do .env.example (pendências soltas).

## Critérios de aceite
- [ ] Checklist LGPD 100% percorrido, cada item ✅ com evidência ou ❌ com gap.
- [ ] Gaps de segurança do Bloco A corrigidos (rate limit, headers, mídia).
- [ ] Anonimização de desligados implementada (configurável, defaults propostos).
- [ ] Restore de backup executado com sucesso em ambiente limpo (log no vault).
- [ ] Métricas do piloto consultáveis.
- [ ] Runbook de go-live revisado, com plano de rollback e plano B de push.
- [ ] Seed de produção pronto (aguardando só os dados reais/autorização).

## Registro de conclusão
_(preencher no fechamento — roadmap + registro no mesmo commit, conforme fluxo)_
