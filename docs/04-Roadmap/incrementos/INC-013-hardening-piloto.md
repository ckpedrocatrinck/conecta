# INC-013 — Hardening pré-piloto

**Status:** 🔄 Em andamento
**Fase:** 5 — Piloto (o último INC de substância antes do go-live)
**Depende de:** todos os anteriores (INC-013.5 mergeado)

## Estado real em 2026-08-04

Este INC estava marcado "⬜ Não iniciado" enquanto **metade dele já estava
mergeada na `main`** — em quatro branches (`inc-013-bloco-b-seguranca`,
`inc-013-g1-anonimizacao`, `inc-013-g11-g12-qualidade`,
`inc-013-g3-runbook-restore`). Esta seção existe para que nenhuma sessão futura
reconstrua o que já existe, o que o próprio "Princípio de trabalho" abaixo
manda evitar.

**Já feito (com evidência no repositório):**

- **Bloco A — checklist LGPD percorrido.** Auditoria de conformidade LGPD completa (2026-07); o relatório detalhado foi removido do repositório na preparação para publicação (INC-027) — os achados foram endereçados nos blocos abaixo.
- **Bloco B — headers de segurança:** HSTS, CSP e `X-Content-Type-Options`
  em `next.config.ts`, cobertos por `next.config.test.ts`.
- **Bloco B — rate limit:** `src/lib/security/rate-limit.ts` (fixed-window em
  memória; usado no login e, desde o INC-022, no coletor de erro client).
- **Bloco B — mídia não pública:** servida via `/api/media` com token, nunca
  por URL adivinhável.
- **Bloco C / G1 — anonimização de desligados:** `src/lib/users/anonymize-sweep.ts`
  (com dry-run, idempotência e `anonymized_at`).

**Falta de verdade:**

- **Execução do teste de restore.** Só o **roteiro** existe
  (`docs/00-Processo/runbook-teste-de-restore.md`); nenhuma evidência de
  execução está no vault. Travado em M2 (confirmar backup ativo/cifrado).
  ⚠️ Além de não executado, o roteiro **está desatualizado desde o ADR-011**:
  o "Caminho A ← recomendado" usa PITR/branch do Neon, que saiu do caminho de
  produção, e o RPO anunciado está errado (com dump diário é ~24h, não
  segundos–minutos — ADR-011 §11/§20.3). Reconciliar antes de executar.
- **Métricas do piloto.** Nenhuma query, doc ou painel existe ainda.
- **Runbook de go-live**, com plano de rollback e plano B de push. Não existe
  (o único runbook no vault é o de restore). O plano B depende do teste de
  push no iPhone — a mesma execução que trava o INC-012 e o critério 6 do
  INC-022.
- **Seed de produção** com dados reais: os seeds de dev existem
  (`prisma/seed.ts`, `prisma/seed-data.ts`), o import real depende dos dados
  e da autorização do Vale Verde.

> As "Dependências externas" mais abaixo neste arquivo ainda estão escritas
> sobre a infraestrutura antiga (ativar o R2, "não sobrevive em serverless
> (Vercel)"). O **ADR-011 (Aceito em 2026-08-04)** substituiu isso por MinIO em
> VPS com disco persistente — a razão de trocar o mock passa a ser
> backup/portabilidade/`delete(key)`, não "o disco some". Reconciliação
> pendente, listada no ADR-011 §18; não corrigida aqui para não misturar
> escopos.

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
- **Ativar o R2 (storage real) — pré-requisito de PRODUÇÃO.** Em dev tudo roda no
  mock local (`LocalMediaStorage`, `.local-media`, servido só via `/api/media`),
  que **não sobrevive em serverless** (Vercel). Trocar o mock pela implementação
  R2 (mesma interface `MediaStorage`) destrava, de uma vez, TUDO que é imagem:
  - fotos de perfil / avatares (INC-003);
  - anexos do feed — imagem + PDF (INC-016);
  - **banner da home + logo do tenant (INC-017)** — sem R2, banner cai no
    fallback fixo e o logo não carrega; **a cor de destaque NÃO depende de R2**
    (é texto no banco, funciona no piloto);
  - logos de benefício (fase 2, fora de escopo por ora).
  É o item de deploy mais crítico: se o R2 falhar, avatar/anexo/banner/logo caem
  juntos. Ao ativar, cumprir também os follow-ups já registrados: `delete(key)`
  na anonimização (purga do blob) e o orphan-sweep de rascunhos (DP-19).
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
