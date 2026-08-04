# ADR-011 — Infraestrutura e Implantação: VPS único no Brasil

**Versão:** 3 (a v1 e a v2 são descartadas — nunca foram oficiais; esta as substitui integralmente).
**Status:** Aceito
**Aceito em:** 2026-08-04 (Pedro Catrinck)
**Data:** 2026-07-31
**Substitui/Amenda:** **ADR-005** (que decidiu "Vercel + Postgres gerenciado Neon/Supafície"). Este ADR revoga a parte de *hospedagem, banco gerenciado e storage* do ADR-005; mantém o restante do ADR-005 (Next.js + PostgreSQL + Prisma + RLS). Com o aceite em 2026-08-04, a parte de hospedagem/banco gerenciado/storage do ADR-005 está oficialmente substituída por este ADR-011 (emenda correspondente já registrada no próprio ADR-005).
**Localização no vault:** `docs/02-Arquitetura/ADR/ADR-011-infraestrutura-e-implantacao.md`.
**Numeração:** confirmada livre — ADR-000 a ADR-010 existem sem buracos; 011 é o próximo.

> Este documento é a fonte de verdade da infraestrutura. Qualquer arquivo que o contradiga deve ser reconciliado conforme §18.

---

## 1. Contexto e decisão

**Restrições que moldam tudo:** orçamento zero até o primeiro contrato; obrigação de conformidade LGPD (o produto *vende* conformidade — errar aqui é fatal); fundador solo com formação em infraestrutura/TI (operação de servidor é o seu ofício); dado tratado é PII de colaborador, incluindo material que compõe **prova jurídica** (anexos e ciência).

**Decisão:** a produção roda em um **VPS único na Hostinger, datacenter de São Paulo**, executando o stack em Docker Compose — aplicação Next.js, PostgreSQL e **MinIO** (storage de objetos S3-compatível), com **upload feito diretamente pelo servidor** (sem presigned — §20.2). Tudo no Brasil, num servidor sob nosso controle.

**Por que esta decisão vence as alternativas:**
- **LGPD:** com tudo em São Paulo, não há transferência internacional de dados. Elimina o nó jurídico do R2 (foto de funcionário fora do país) e simplifica o Aviso de Privacidade. Para um produto de compliance, "seus dados ficam no Brasil, em servidor sob nosso controle" é a narrativa mais forte diante de um comprador de RH.
- **Custo:** um VPS (~US$5–15/mês) substitui Vercel Pro (US$20, obrigatório para uso comercial) + banco gerenciado + storage gerenciado.
- **Coerência dev↔prod:** o stack já roda em Docker na máquina do Pedro; o mesmo Compose sobe no VPS.
- **Perfil:** o custo desta escolha é operacional (backup, segurança, uptime, ponto único de falha — §17). Afundaria um fundador só-dev; para um perfil de infra, está na competência.

---

## 2. Princípios inegociáveis (o "não podemos ter falha")

Regras, não recomendações. Quebrá-las põe a prova jurídica — o núcleo do produto — em risco.

1. **Backup automático ANTES de cada migration**, guardado **fora do disco do VPS**. Migration é quase irreversível; o que desfaz um estrago de dado é o backup de antes.
2. **Backup fora do VPS e no Brasil** (ou cifrado, se sair do país — senão reabre a transferência internacional que a arquitetura eliminou).
3. **Restore testado, não presumido** (§11). Backup nunca restaurado é esperança, não backup.
4. **Build nunca no VPS** (§9). `next build` come memória; buildar com Postgres+storage rodando pode derrubar a produção.
5. **Secrets fora do git**, sempre.
6. **Ordem sagrada do deploy:** backup → migration → subir app.
7. **Os dois backups (banco e mídia) têm que ser reconciliáveis entre si** (§11). Uma linha no banco aponta para um objeto na mídia; backups de momentos diferentes podem gerar "linha sem objeto" — prova quebrada.
8. **Disco monitorado** (§15). Disco cheio → Postgres para → app cai. É a causa nº1 de queda em stack self-hosted.

---

## 3. As quatro fases

| Fase | Quando | Onde | Dado real? | Custo |
|---|---|---|---|---|
| **1. Desenvolvimento** | Agora → sem cliente | Localhost / Docker | Não (seed) | R$ 0 |
| **2. Demonstração** | Contrato iminente | Vercel Hobby | **Não — só seed** | R$ 0 |
| **3. Produção** | 1º contrato | VPS Hostinger SP | Sim (PII real) | ~US$5–15/mês |
| **4. Escala** | Múltiplos clientes | Reavaliar (VPS maior / réplica / AWS sa-east-1) | Sim | Coberto por receita |

**Regra transversal:** PII real de colaborador só existe na Fase 3 (Brasil). Fases 1 e 2 usam dado fictício — mantém dev e demo fora de qualquer questão de LGPD.

---

## 4. Fase 1 — Desenvolvimento (agora, R$ 0)

- Escrever a implementação `S3MediaStorage` da interface `MediaStorage` contra o **MinIO** (§20.1), rodando como container no Compose local, com **upload direto pelo servidor** (§20.2).
- **Nome canônico da classe: `S3MediaStorage`** (agnóstico de fornecedor — serve MinIO, R2, S3). O INC-016 fala em `R2MediaStorage`; ao executar, alinhar o INC-016 a este nome.
- **Resolver as três armadilhas do storage** (não é só trocar a classe):
  - **(a) Validação do avatar — resolvida pela decisão §20.2 (upload direto):** como o upload passa pelo servidor, a validação de tipo (magic number) volta a ser **server-side para todos os tipos, na hora do upload**. Não há mais o buraco do avatar que o fluxo presigned criava, e não é preciso etapa de confirm separada. A armadilha some por construção.
  - **(b) `getViewUrl` relativo → absoluto:** contrato implícito que `api/anexo` assume; revisar consumidores.
  - **(c) `delete(key)` na anonimização:** hoje `anonymizeUser` zera o campo no banco mas não apaga o objeto. Requisito de LGPD.
- **Pré-requisito DP-21:** `npm install` bloqueado na máquina do Pedro. O MinIO é acessado via `@aws-sdk/client-s3`, então gerar o lock com essa dependência em container limpo (`node:22`), como no next-auth.

---

## 5. Fase 2 — Demonstração (contrato iminente, R$ 0)

- **Vercel Hobby** para reuniões e demos. Deploy por `git push`, HTTPS automático.
- **Linha vermelha:** só dado seed/fictício. Nenhuma PII real no Vercel (Hobby é não-comercial e pode usar conteúdo para treino; dado real só na Fase 3).

---

## 6. Fase 3 — Produção (1º contrato, ~US$5–15/mês)

- **VPS Hostinger, São Paulo.** Dimensionar com folga de RAM (Postgres + storage + app coexistem; o build não roda aqui — §9).
- `docker-compose.yml` de produção: app Next.js (imagem pronta do registro), PostgreSQL, storage de objetos, **reverse proxy** (Traefik/Caddy) para HTTPS automático.
- Só o proxy vê a internet; Postgres e storage só na rede interna do Compose.
- **Custo obrigatório de segurança:** backup off-site (§11) e monitoramento de disco (§15) — não opcionais.
- **Antes do go-live:** Aviso de Privacidade + mapeamento de dados no modelo operador-controlador (§16).

---

## 7. Fase 4 — Escala (múltiplos clientes)

Gatilhos para reavaliar (não para antecipar):
- Ponto único de falha inaceitável com clientes externos → réplica, ou migração para nuvem gerenciada BR / AWS sa-east-1 (código de storage já portável — §1).
- 2º cliente **externo** muda o risco jurídico: contrato de operador entre empresas passa a ter responsabilidade contratual real → advogado deixa de ser adiável (aí há receita).
- **RPO/PITR:** o piloto aceita RPO de ~24h (§11); múltiplos clientes provavelmente não. É aqui que o WAL archiving (§11) entra como obrigatório, se não tiver entrado antes.

---

## 8. Arquitetura de produção

Serviços no Compose, mesma rede interna:
- **`app`** — Next.js `output: "standalone"`, rodando `node server.js`. Não exposta direto.
- **`postgres`** — volume persistente; duas roles (owner para migrate/seed, `conecta_app` runtime — ADR-003/008). Não exposto.
- **`minio`** — MinIO (§20.1), volume persistente. **Versionamento de bucket LIGADO** (protege contra delete/overwrite acidental — recuperação de objeto sem depender de backup).
- **`proxy`** — Traefik/Caddy. Único exposto (80/443). Terminação TLS (Let's Encrypt automático) e roteamento.

Firewall: só 80, 443 e SSH. Postgres e storage **nunca** na internet.

---

## 9. Pipeline de implantação (build fora, deploy dentro)

1. **CI (GitHub Actions) builda a imagem** (estende o workflow que já roda `npm run build`) e empurra para o **GHCR** (`ghcr.io`, gratuito).
2. **VPS só puxa a imagem pronta** — nunca builda.
3. **Sequência sagrada:** backup do banco → `prisma migrate deploy` → `docker compose up -d` com a imagem nova.

Recupera quase a experiência do Vercel (`git push` → build+deploy), mas o pipeline é nosso. O portão continua sendo lint+typecheck+test+build no CI antes de publicar imagem.

---

## 10. Migrations — a disciplina que protege a prova

Migration em produção é o maior risco da operação: **quase irreversível**. Se corromper dado, o Prisma não desfaz — o backup de antes desfaz.

- Sempre `prisma migrate deploy` (norma do ADR-008; o diff automático quebra a coluna `GENERATED` de `search_vector`).
- **Backup do banco imediatamente antes**, automatizado no script de deploy de forma que pular seja impossível.
- Role owner roda a migration; runtime usa `conecta_app`.
- Schema novo primeiro, código que o usa depois.

---

## 11. Backup, RPO e a honestidade sobre o que se perde

Aqui está a parte que a v1 tratava com otimismo e o v2 corrige. **Dois volumes carregam a prova:** Postgres (dados, auditoria, ciência) e o storage de mídia (anexos — que também são prova). Perder qualquer um é perder prova. E há **duas ameaças distintas, que exigem mecanismos distintos** — a v1 as confundia:

**Ameaça A — erro lógico** (migration ruim, delete acidental): recupera-se voltando a um ponto *antes* do erro. Proteção: backup com granularidade fina.
**Ameaça B — desastre físico** (disco/VPS morre): recupera-se de uma cópia *fora do VPS*. Proteção: backup off-site.

**RPO — declarado com honestidade.** RPO = quanto de dado você aceita perder. Com **dump diário**, o RPO é de **até ~24h**: um desastre às 23h perde tudo desde o dump da meia-noite. Para o núcleo de prova, isso significa que uma ciência dada hoje pode não estar no backup — **prova perdida**. Você precisa decidir conscientemente (§20.3) se ~24h é aceitável no piloto.

**Postgres:**
- Off-site (Ameaça B): `pg_dump` agendado — no mínimo diário, e sempre antes de migration. Cifrado se sair do Brasil.
- Granularidade fina (Ameaça A): a resposta self-hosted equivalente ao PITR do Neon é **WAL archiving** (arquivamento contínuo do write-ahead log), que derruba o RPO de ~24h para minutos. **Ressalva honesta:** WAL só protege de verdade se o arquivo do WAL for **transmitido continuamente para fora do VPS** — WAL no mesmo disco que morre com o banco é falsa segurança, e é complexidade real (um fluxo contínuo off-box, não um dump diário). Ver §20.3: eu **não** mando WAL como obrigatório no piloto — seria DR de enterprise num VPS de bootstrap. Marco como obrigatório antes da Fase 4.

**Mídia (storage de objetos):**
- Versionamento de bucket ligado (§8) já protege da Ameaça A (delete/overwrite acidental recuperável).
- Off-site (Ameaça B): espelho (`mc mirror` ou equivalente) agendado. **O RPO da mídia é limitado pela cadência do espelho** — se o Postgres tem PITR de minutos mas a mídia espelha 1×/dia, um anexo enviado hoje se perde num desastre mesmo com o banco recuperado ao minuto. Para manter a prova coerente, a cadência do espelho deve acompanhar a criticidade do anexo.

**Consistência entre os dois (Princípio §2.7):** o banco referencia objetos da mídia. Backups de momentos diferentes produzem "linha sem objeto" ou "objeto sem linha". Regras:
- **Coordenar o timing** dos dois backups o quanto der.
- **Reconciliar no restore:** varrer órfãos (linha de mídia sem objeto → marcar/limpar; objeto sem linha → candidato a órfão). Este é o mesmo *orphan-sweep* que o INC-016 já previa — aqui ele vira também rotina de pós-restore.

**Retenção:** várias gerações (diários 7–14 dias + semanal por alguns meses), para voltar a um ponto anterior a uma corrupção percebida dias depois.

**Restore testado (§2.3):** restaurar periodicamente num ambiente descartável, subir a app, conferir que banco e mídia batem (a reconciliação acima roda limpa).

> Backup também é tratamento de dado pessoal (LGPD). No Brasil ou cifrado; com retenção definida.

---

## 12. Rollback — código volta fácil, dado não

- **Código:** imagem anterior está no GHCR; re-subir a tag anterior. Um comando.
- **Dado:** não volta sozinho. Se o problema foi a migration, restaura-se o backup pré-migration (§10/§11). Por isso o backup-antes-de-migrar é o que torna o rollback de dado possível.

---

## 13. HTTPS e reverse proxy

**Traefik** (config por labels no Compose) ou **Caddy** (config mínima): HTTPS automático via Let's Encrypt, renovação inclusa. Único serviço exposto; termina TLS e roteia por rede interna. Apontar o DNS para o IP do VPS.

> Substitui o "HTTPS de graça da plataforma" que a auditoria de conformidade atribuía ao Vercel. No VPS, o HTTPS é responsabilidade do proxy — o controle M1 do LGPD passa a depender desta configuração, não da plataforma.

---

## 14. Atualização de versões

- **App / Next / Node / storage:** muda Dockerfile ou tag, rebuilda no CI, deploya. Rotina (§9).
- **PostgreSQL major (ex.: 16→17):** **não** é trocar tag — é evento planejado (dump-and-restore ou `pg_upgrade`), com backup e janela. Trocar a tag major sem migrar corrompe/impede a subida. Cerimônia, não deploy.
- **Dependências npm:** DP-21 — install em container limpo.

---

## 15. Segurança do VPS (hardening mínimo, dia 1)

- **SSH só por chave**; root login desabilitado; usuário com sudo.
- **Firewall (UFW):** só 80, 443, SSH. Postgres/storage nunca expostos.
- **`fail2ban`** no SSH; **atualizações de segurança automáticas** do SO.
- **Secrets** em `.env` com permissão restrita, fora do git e de logs.
- **Monitoramento:** uptime (ex.: UptimeRobot, grátis), erros (Sentry, já no stack) **e espaço em disco** (Princípio §2.8 — alerta antes de encher; disco cheio derruba o Postgres).
- **Medidas mínimas ANPD** (já são a engenharia atual): senha individual, acesso por perfil (RLS+roles), criptografia de dado sensível, descarte seguro (anonimização).

---

## 16. LGPD — o que esta arquitetura simplifica

- **Sem transferência internacional** (tudo em SP). O Aviso de Privacidade não precisa da cláusula do Art. 33 — a menos que um backup saia do Brasil, e aí ele vai **cifrado** (§2.2).
- **Modelo operador-controlador:** no piloto o **Vale Verde é o controlador** (empregador, já trata dado de funcionário legalmente); a **Conecta é operador**. A base legal do dado **não é do Conecta inventar** — é a relação de emprego (execução de contrato / obrigação legal), **não consentimento** (frágil na relação de trabalho).
- **Não misturar a "ciência" do produto com a base legal.** Ciência = feature ("viu o comunicado X"). Base legal = relação de emprego. Emaranhar é erro.
- **Regime simplificado:** Resolução CD/ANPD nº 2/2022 (PMEs/startups).
- **Limite honesto:** DIY é defensável para o piloto no próprio empregador. O 2º cliente externo exige contrato de operador revisado por advogado. *(Informação, não parecer jurídico — redação final é de advogado.)*

---

## 17. Riscos e mitigações (a parte honesta)

| Risco | Gravidade | Mitigação |
|---|---|---|
| Ponto único de falha (um VPS) | Alta na escala; aceitável no piloto | Backup off-site testado; monitoramento; Fase 4 reavalia réplica |
| Ops sobre uma pessoa | Média | Perfil de infra do Pedro; automação; runbook |
| **Backup mal-feito/não testado** | **Crítica** (perde prova) | §11 como obrigação; restore testado; gerações |
| **RPO de ~24h no piloto** | Média-alta | Decidir conscientemente (§20.3); WAL antes da escala |
| **Inconsistência banco↔mídia no restore** | Alta | Reconciliação de órfãos (§11); timing coordenado |
| Migration corrompe dado | Alta | Backup antes; ordem sagrada (§10) |
| Disco cheio derruba o Postgres | Alta | Monitor de disco (§15) |
| VPS invadido | Alta | Hardening (§15); portas fechadas; secrets fora do git |
| Contrato de operador frágil (externo) | Alta na Fase 4 | Advogado antes do 2º cliente |
| Postgres major mal migrado | Alta | Cerimônia (§14) |

Nenhum é motivo para não seguir. Todos são motivo para seguir **com disciplina** — que é o que "não podemos ter falha" exige.

---

## 18. Reconciliação do vault (o que emendar, por conteúdo — sem números de linha, que envelhecem)

- **ADR-005** — amendar (ADR nunca se apaga): registrar que a parte de hospedagem/banco/storage foi substituída por este ADR-011, e que o gatilho de revisão "Vercel caro em escala → avaliar VPS" **disparou em 2026-07-31**, com a resposta sendo Hostinger.
- **`stack.md`** — ✅ já ajustado (storage=MinIO/S3-compat, hospedagem=VPS SP, banco=Postgres no VPS, região=SP). Pontas restantes: o Status "Proposta/INC-001", "logs da plataforma" e "cron da plataforma" (não há plataforma no VPS — o cron vira crontab/sidecar).
- **`05-Decisoes-Pendentes.md`** — trocar toda dependência de "ativar R2" por "ativar o storage no VPS" (o código é o mesmo). E: M2/M3/G3 amarrados a "painel do Neon/Vercel" viram "configurar pg_dump + off-site" (construir, não verificar em painel); G2 destrava (região já respondida: SP).
- **`runbook-teste-de-restore.md`** — o "Caminho A ← recomendado" (branch/PITR do Neon) deixa de existir; o roteiro passa a `pg_dump`/`pg_restore` + snapshot Hostinger + a reconciliação banco↔mídia (§11); e o **RPO anunciado precisa ser corrigido** (não é "segundos–minutos" com dump diário; é ~24h, ou minutos só com WAL — §11).
- **`lgpd-requisitos-tecnicos.md`** — o item de transferência internacional vira "✅ N/A — tudo em SP", com a regra nova: backup fora do Brasil vai cifrado (§2.2).
- **`guia-conformidade-lgpd.md` / `aviso-privacidade.md`** (untracked) — cortar as ressalvas condicionais "se a infra estiver fora do Brasil"; a infra está no Brasil.
- **`roadmap.md`** — registrar as 4 fases de infra; trocar as menções a R2.
- **`INC-016`, `INC-013`, `INC-017`, `INC-018`** — trocar "R2" por "storage real"; **re-fundar o argumento "serverless/disco efêmero"** (num VPS o disco é persistente — a razão de trocar o mock passa a ser backup/portabilidade/`delete(key)`, não "disco some"); e — consequência da decisão §20.2 — **substituir o fluxo presigned+confirm do INC-016 por upload direto pelo servidor** (sem presigned, sem CORS, validação server-side na hora). O `INC-018` também precisa trocar "Vercel Cron" pelo mecanismo do VPS (crontab/sidecar), senão o agendamento nunca dispara.
- **Nota:** "guia-ativacao-storage-r2.md" **não existe** no vault (a v1 do ADR o citava por engano). O conteúdo equivalente vive na seção de pré-requisito do INC-016. Referenciar essa seção, não um arquivo fantasma.

---

## 19. Pré-requisitos e ordem

**Pré-requisitos:**
1. ✅ **ADR aceito em 2026-08-04.**
2. **DP-21 resolvida** (o MinIO usa aws-sdk — §20.1/§4).

**Ordem (do R$ 0 ao contrato):**
1. Agora: implementação do storage (MinIO + upload direto) + as armadilhas (b) e (c) do §4 — a (a) já some pela decisão §20.2. Conforme as decisões registradas na §20.
2. Agora, paralelo: insumo jurídico (Aviso + mapeamento).
3. Agora, opcional: artefatos de deploy (Dockerfile standalone, Compose de prod, workflow CI→GHCR→VPS, script backup-antes-de-migração + reconciliação).
4. Contrato iminente: demo no Vercel com seed.
5. Contrato assinado: provisionar VPS SP, subir, configurar backup+hardening+HTTPS+monitor de disco, DNS, go-live.

---

## 20. Decisões de implementação (registradas)

As quatro sub-decisões que a v2 deixava em aberto foram **fechadas por Pedro em 2026-07-31**. Registro aqui a escolha, a alternativa rejeitada e o porquê — para o INC do storage ser escrito sem adivinhação e para a decisão ficar rastreável.

### 20.1 — Storage: **MinIO** (rejeitado: disco puro)
Num VPS com volume persistente, disco puro funcionaria. Escolhido **MinIO** pela **portabilidade** (a API S3 torna a migração futura para AWS sa-east-1 na Fase 4 uma troca de config, não reescrita) e pelo **versionamento de bucket** de graça (proteção contra delete/overwrite acidental — §8). Custo aceito: um serviço a mais e credenciais S3.

### 20.2 — Upload: **direto pelo servidor** (rejeitado: presigned)
O presigned existia por **um único motivo** — o limite de 4,5 MB de payload serverless da Vercel (INC-016). No VPS esse limite não existe, então o presigned era complexidade herdada do mundo serverless. Escolhido **upload direto**: a app recebe o arquivo, valida por magic number na hora e grava no storage. **Elimina de uma vez** o presigned, a config de CORS e a armadilha da validação do avatar (§4a). A portabilidade que importa é a da *interface* `MediaStorage`, não a do mecanismo de upload. Consequência: **contradiz parte do INC-016**, que deve ser alinhado (§18). Se a Fase 4 voltar a serverless, o presigned se reintroduz, com receita para bancar.

### 20.3 — RPO do piloto: **~24h aceito** (dump diário); WAL obrigatório antes do 2º cliente
Aceito, de olhos abertos, o RPO de até ~24h no piloto (dump diário + versionamento de bucket), por ser um piloto de um cliente (o próprio empregador). **WAL archiving off-site fica marcado como obrigatório antes do 2º cliente** (§7, §11). Se em algum momento do piloto ~24h se mostrar inaceitável para a prova, a saída barata antes do WAL é subir a cadência do dump (ex.: de 6 em 6h).

### 20.4 — Formato: **um doc só** (decisão + runbook), extraível depois
Mantido **um documento**, com as §8–15 (runbook operacional) demarcadas de forma que possam ser extraídas para um `runbook-operacao-vps.md` no futuro **sem reabrir a decisão**. Separar agora não agrega; separar depois, se o runbook crescer, é trivial.


---

## Registro de conclusão

_(preencher quando a Fase 3 for ao ar; anotar o que mudou do previsto — em especial as escolhas de §20)_
