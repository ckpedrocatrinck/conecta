# Modelo de Dados (MVP)

> Nível conceitual/lógico. O físico (Prisma schema) nasce no INC-002 e deve referenciar este arquivo. Toda tabela de domínio carrega `tenant_id` (ADR-003) e timestamps `created_at/updated_at`.

## Fundação

```
Tenant        id, name, slug, status, plan
Branch        id, tenant_id, name, code                     -- filial
User          id, tenant_id, branch_id, role(admin|manager|employee),
              full_name, registration_code,                 -- matrícula: identificador interno, NÃO login
              cpf_hash,                                     -- hash determinístico + pepper; credencial de login (ADR-006)
              birth_date, birthday_visible(bool),           -- opt-out LGPD
              hired_at,                                     -- p/ tempo de casa
              photo_url, phone?, email?,
              status(active|inactive),                      -- desligado ≠ deletado (ADR-006 / LGPD)
              anonymized_at?,                               -- preenchido quando dados pessoais são anonimizados
              password_hash, must_change_password(bool)
PushSubscription  id, user_id, endpoint, keys, created_at
AuditLog      id, tenant_id, actor_user_id, action, entity, entity_id,
              metadata(jsonb), created_at                   -- ações administrativas
```

## Núcleo — Comunicados

```
Announcement          id, tenant_id, seq_number, year,      -- "CI 25/2026" derivado
                      category, criticality(info|requires_ack),
                      status(draft|scheduled|published|archived),
                      publish_at, created_by
AnnouncementVersion   id, announcement_id, version_number,
                      title, body(rich), content_hash,      -- hash p/ evidência
                      created_at, created_by
AnnouncementAudience  announcement_id, branch_id            -- vazio = todos
AnnouncementRead      id, announcement_id, version_id, user_id,
                      read_at                               -- abriu
AnnouncementAck       id, announcement_id, version_id, user_id,
                      acked_at, content_hash_at_ack         -- declarou ciência
                      UNIQUE(announcement_id, version_id, user_id)
```

Regras de domínio:
1. `seq_number` é sequencial por tenant+ano, atribuído na **publicação** (rascunho não consome número).
2. Editar comunicado publicado ⇒ nova `AnnouncementVersion`. Se `requires_ack` e a mudança for marcada como material pelo admin ⇒ pendências reabrem (acks antigos permanecem no histórico, vinculados à versão antiga).
3. `AnnouncementAck` é **imutável** (sem update/delete via aplicação).

## Engajamento — Feed

```
Post          id, tenant_id, type(recognition|tenure|promotion|general),
              title, body?, event_date,
              status(draft|published), created_by
PostPerson    post_id, user_id, label?                      -- pessoas homenageadas
PostMedia     post_id, media_url, sort_order
PostReaction  post_id, user_id, UNIQUE(post_id, user_id)
```

Aniversariantes **não são tabela**: são query sobre `User` (birth_date, birthday_visible, branch) — zero manutenção para o RH.

## Vagas internas

```
JobOpening    id, tenant_id, title, description(rich),
              branch_id?,                                   -- null = todas
              shift?, requirements?, deadline,
              status(open|closed), created_by
JobApplication id, job_opening_id, user_id, note?, created_at,
               UNIQUE(job_opening_id, user_id)
```

## Índices críticos (mínimo)

- `AnnouncementAck(announcement_id, version_id)` e `(user_id)` — painel de pendências.
- `User(tenant_id, branch_id, status)` — cálculo de pendentes = ativos do público-alvo − acks.
- Busca de comunicados: índice full-text (tsvector pt) em `AnnouncementVersion(title, body)`.

## Decisões resolvidas (ADR-006)

- **`User` desligado:** `status=inactive` imediato; anonimização dos dados pessoais após retenção (default 24 meses), com `anonymized_at` marcando o evento; registros de ciência preservados sob identificador pseudonimizado pelo prazo prescricional trabalhista. Implementar a rotina no INC-013.
- **`AnnouncementRead`:** grava só a **primeira** abertura por versão (não toda visualização).
- **Autenticação:** login por CPF completo; `cpf_hash` é determinístico com pepper (busca no login sem valor em claro). `registration_code` não é credencial.
