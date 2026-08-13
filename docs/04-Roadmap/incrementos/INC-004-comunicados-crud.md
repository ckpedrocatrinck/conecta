# INC-004 — Comunicados: CRUD admin + versionamento

**Status:** ✅ Concluído
**Fase:** 2 — Núcleo jurídico
**Depende de:** INC-003
**ADRs relevantes:** 001

## Objetivo
Admin cria, agenda e publica comunicados estruturados com numeração automática e versionamento imutável.

## Escopo
1. CRUD no painel: título, corpo rich text (editor simples: negrito, itálico, listas, links), categoria, criticidade, público-alvo (todos | filiais). ANEXOS: deferidos para fase posterior (decisão de Pedro, 2026-07-10 — o valor do núcleo é texto versionado + ciência; anexo entra depois se o piloto pedir).
2. Estados: draft → scheduled → published → archived. Número `CI NN/AAAA` atribuído na publicação (sequência por tenant+ano, à prova de corrida).
3. Edição pós-publicação = nova versão com `content_hash`; marcar "mudança material" reabre pendências (só se `requires_ack`).
4. Agendamento de publicação (cron da plataforma).
5. Busca full-text pt-BR na listagem admin.

## Critérios de aceite
- [x] Dois admins publicando simultaneamente não geram número duplicado (teste).
- [x] Editar comunicado publicado gera versão nova; hash muda; versão antiga permanece íntegra.
- [x] Rascunho não consome número.
- [x] Público-alvo por filial restringe visibilidade (validar com usuários de filiais diferentes do seed).

## Registro de conclusão

## Relatório de Entrega — INC-004
**Data:** 2026-07-10
**Branch:** inc-004-comunicados-crud

### O que foi implementado
- **Numeração `CI NN/AAAA` à prova de corrida**: tabela nova `AnnouncementSequence` (`tenant_id, year, last_number`, RLS igual às demais) + `nextAnnouncementSequenceNumber()` (`src/lib/repositories/announcement-sequence.repository.ts`) via `INSERT ... ON CONFLICT (tenant_id, year) DO UPDATE SET last_number = last_number + 1 RETURNING last_number` — atômico, sem `SELECT ... FOR UPDATE`/advisory lock. `Announcement.year` passou a ser `Int?` (migration `20260710173006_announcement_sequences_and_year_nullable`): `seq_number` e `year` só são preenchidos juntos, no instante da publicação (ano UTC daquele instante), nunca escolhidos pelo admin.
- **`publishAnnouncement()`** (`src/lib/announcements/publish.ts`) — único caminho que publica (draft/scheduled → published), usado pela Server Action "Publicar agora" e pelo sweep do cron. Verifica o `count` do UPDATE final: se 0 (perdeu a corrida contra outro publish do mesmo rascunho), retorna `skipped` em vez de mentir "published" — bug real que os próprios testes de concorrência pegaram durante a implementação (ver "Decisões" abaixo).
- **Versionamento**: `AnnouncementVersion.isMaterialChange` (novo, `boolean default false`) — toda save (rascunho ou edição pós-publicação) sempre faz **INSERT** de nova versão, nunca UPDATE (a migration do INC-002 já não concede UPDATE em `announcement_versions` — append-only por desenho; aproveitei essa restrição existente em vez de reabri-la). Checkbox "mudança material" só aparece no form quando `status=published` e `criticality=requires_ack`; a flag é só persistida — reabertura de pendência é INC-005.
- **Editor de rich text**: Tiptap com extensões importadas individualmente (`Document/Paragraph/Text/Bold/Italic/BulletList/OrderedList/ListItem/Link/History` — sem `starter-kit` completo, só o que o escopo pede). `src/components/announcements/rich-text-editor.tsx` (client) + `rich-text-content.tsx` (renderer read-only). Sanitização com `sanitize-html` (`src/lib/sanitize/announcement-body.ts`, allowlist `p/br/strong/em/b/i/ul/ol/li/a`, `href` só `http/https/mailto`) **no servidor, na Server Action, antes do hash** — nunca confia no HTML do cliente.
- **Estados/transições**: `draft→scheduled→published→archived`, `scheduled→draft` (cancelar agendamento), `archived` terminal (sem volta). Repositório estendido em `announcement.repository.ts` (`createAnnouncementDraft`, `scheduleAnnouncementPublication`, `unscheduleAnnouncement`, `archiveAnnouncement`, `markAnnouncementPublished`, `updateAnnouncementCriticality` — só quando `seqNumber===null`, `findVisibleAnnouncementIdsForUser`, `searchAnnouncementIds`, `findAnnouncementsForAdminList`).
- **Cron sem worker dedicado**: `src/lib/announcements/scheduled-sweep.ts` (`runScheduledAnnouncementSweep`) itera `findActiveTenants()` (já existente, único ponto legítimo de enumeração cross-tenant) e publica, por tenant, todo `scheduled` com `publishAt <= now`. Exposto em `GET /api/cron/publish-announcements`, autenticado por `CRON_SECRET` (novo env, documentado no `.env.example`; configuração do disparo periódico em si fica fora deste repo).
- **Busca full-text pt-BR**: reaproveita o índice GIN já criado no INC-002 (`announcement_versions.search_vector`); `searchAnnouncementIds()` filtra pela versão **atual** de cada comunicado (não por histórico).
- **Telas admin**: `/admin/comunicados` (listagem com filtro de status + busca), `/admin/comunicados/novo` (criar rascunho), `/admin/comunicados/[id]` (editar, histórico de versões, ações de publicar/agendar/cancelar/arquivar). Usa `Card`/`Button`/`EmptyState`/`Label`/`Checkbox`/`Input` do INC-003.5; `requireAdmin()` + `withTenant()` em toda rota/action, sem excepão.

### Decisões tomadas durante a implementação
- **Bug de corrida pego pelo próprio teste, não pela revisão**: a primeira versão de `publishAnnouncement()` não checava o `count` do UPDATE final — no cenário "dois admins publicam o MESMO rascunho ao mesmo tempo", o segundo relataria `published` com um número que nunca foi de fato gravado. Corrigido antes de qualquer commit; documentado no código (`publish.ts`) por que isso importa.
- **`year` nullable + tabela `AnnouncementSequence` nova**: ambas fora do `modelo-de-dados.md` original — confirmadas com Pedro antes de implementar (ver histórico do plano). `year` muda de `Int` para `Int?` (INC-002 tinha deixado `NOT NULL`); a tabela nova é puramente física, sem entidade nova no vault conceitual.
- **Anexos adiados**: escopo pede "anexos" no CRUD, mas não há entidade modelada em `modelo-de-dados.md` para isso. Decisão confirmada com Pedro: não modelar agora — fica como pendência abaixo.
- **Bug real achado na verificação manual (não nos testes automatizados)**: `prisma/seed-data.ts` cria a amostra de comunicados do tenant de dev com `seq_number` fixo (1/2/3) sem passar pelo contador atômico novo — a primeira publicação real feita pela UI colidia com a unique constraint e retornava 500. Corrigido no próprio seed (upsert do contador para `max(seq)` da amostra, só quando há amostra). Sem esse fix, **qualquer tenant com histórico de numeração pré-existente feito fora do fluxo do app** (migração de dados legados, por exemplo) teria o mesmo problema — vale registrar como requisito operacional para migrações futuras de dados históricos.
- **Critério de bloqueio de `criticality`**: travei a edição de criticidade quando `seqNumber !== null` (ou seja, já foi publicado alguma vez, mesmo que hoje arquivado) — não documentado explicitamente no INC, decisão minha para não reabrir a semântica de acks antigos silenciosamente. Sinalizado para revisão.
- **`archived` sem edição nenhuma** (não só sem republicação): ao chegar em arquivado, a tela vira somente-leitura (sem histórico de versões editável, sem formulário) — mais simples que permitir edição "morta".

### Como testar
1. `npm run dev` na branch `inc-004-comunicados-crud`; logar como admin do tenant seed (Rede Vale Verde).
2. `/admin/comunicados/novo`: criar com negrito/itálico/lista/link no corpo, categoria, criticidade "Exige confirmação de leitura", público-alvo = 1 filial. Salvar — nenhum código `CI` aparece (rascunho).
3. Na tela do comunicado criado, clicar "Publicar agora" — título passa a mostrar `CI NN/AAAA` (número sequencial real do tenant/ano).
4. Editar o mesmo comunicado (mudar o texto), marcar "mudança material", salvar — histórico de versões mostra 2 versões, hashes diferentes, badge "mudança material" na versão 2, versão 1 inalterada.
5. Criar outro rascunho, "Agendar" para uma data/hora passada (ou aguardar uma futura próxima), depois `GET /api/cron/publish-announcements` com header `Authorization: Bearer <CRON_SECRET>` — comunicado passa a `published` com o próximo número da sequência. Sem o header (ou com secret errado) o endpoint responde 401.
6. Buscar por uma palavra do corpo na listagem (`?q=...`) — aparece nos resultados; buscar por palavra inexistente — mostra o estado vazio.
7. Arquivar um comunicado publicado — tela vira somente-leitura, sem botão de reverter.
8. `npm run lint && npm run typecheck && npm run test` — todos passam (64/64 testes).

**Verificação end-to-end real feita nesta entrega** (não só descrita): subi o dev server e dirigi o fluxo completo via HTTP real (login → troca de senha → aviso de privacidade → criar rascunho com HTML rico incluindo uma tag `<script>` → publicar → editar com "mudança material" → agendar → cron → listagem/busca), autenticado como o admin seedado, sem atalhos de import direto. Isso pegou o bug de corrida do seed (item acima) que nenhum teste automatizado cobria, porque os testes usam um tenant isolado sem a amostra pré-numerada.

### Critérios de aceite
- [x] Dois admins publicando simultaneamente não geram número duplicado — teste de integração com 12 publicações concorrentes de rascunhos distintos (`tests/integration/announcement-publishing.test.ts`) e um teste adicional do caso extremo "mesmo rascunho, dois publishes simultâneos" (1 published + 1 skipped, sem duplicata).
- [x] Editar comunicado publicado gera versão nova; hash muda; versão antiga permanece íntegra — teste dedicado + verificado manualmente (versão 1 preservada byte-a-byte após a versão 2).
- [x] Rascunho não consome número — teste dedicado (múltiplos saves em rascunho, `seqNumber`/`year` permanecem `null`) + verificado manualmente.
- [x] Público-alvo por filial restringe visibilidade — `findVisibleAnnouncementIdsForUser` testada com usuários de filiais diferentes do seed (audiência vazia = todos; audiência com 1 filial exclui usuário de outra filial). Tela de leitura em si é INC-005; aqui só a camada de dados que ela vai consumir.

### Pendências / dívidas técnicas criadas
- **Anexos**: não modelados neste INC (confirmado com Pedro) — precisa de decisão de modelagem (reaproveitar `media-storage` existente?) antes de um INC futuro implementar.
- **Requisito operacional para migração de dados históricos**: qualquer processo que crie `Announcement` com `seq_number` pré-atribuído fora de `publishAnnouncement()` (ex.: importação de numeração legada do portal legado) precisa também atualizar `announcement_sequences.last_number` para o máximo usado naquele tenant+ano — documentado no comentário de `prisma/seed-data.ts`, mas vale um lembrete formal quando a migração de dados legados for planejada.
- **Trava de `criticality` pós-primeira-publicação**: decisão minha, não documentada no INC original — Pedro deve confirmar se é o comportamento desejado ou se merece um ADR próprio.
- **Fragilidade pré-existente nos testes de integração**: `ALTER TABLE announcement_acks DISABLE/ENABLE TRIGGER USER` (usado na limpeza de `tenant-isolation.test.ts` e `auth-and-employees.test.ts`) é global, não escopado à conexão/transação — dois arquivos de teste limpando em paralelo podem colidir (observei isso rodando a suite: um teste do INC-002 falhou de forma transitória por essa razão, antes de eu remover a necessidade desse padrão no arquivo novo do INC-004 passando `includeSampleAnnouncements: false`). Não é uma regressão desta entrega, mas fica registrado — um INC futuro de manutenção de testes pode valer a pena.
- **Dark mode / itens de bottom nav**: já eram pendências herdadas do INC-003.5, não tocadas aqui.
