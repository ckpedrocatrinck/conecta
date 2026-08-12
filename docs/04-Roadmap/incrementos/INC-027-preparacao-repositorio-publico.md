# INC-027 — Preparação e publicação do repositório

**Status:** ⬜ Não iniciado
**Fase:** Fora de fase (higiene de repositório / infraestrutura de portfólio)
**Depende de:** ADR-012 aceito
**ADRs relevantes:** 012, 010 (slug na URL), 011 (infra)
**Docs:** `auditoria-2026-07.md`, `03-LGPD/lgpd-requisitos-tecnicos.md`, `00-Processo/convencoes-git.md`

## Objetivo

Publicar o repositório do Conecta sem nenhum vínculo a empresa real (em conteúdo,
histórico, mensagem de commit, nome de arquivo, imagem ou log de CI), sem segredo e sem
dado pessoal de terceiro, com seed de demonstração povoado e vitrine legível — mantendo o
repositório como local de trabalho ativo do produto.

## Regra de execução

**Tornar o repositório público é o último passo e depende de autorização explícita do
Pedro.** Nenhum bloco de 0 a 5 altera a visibilidade do repositório. O Bloco 6 é
irreversível: só começa quando todos os critérios de aceite dos blocos anteriores estiverem
verificados **e** houver autorização registrada. Não há prazo — se qualquer critério ficar
em aberto, o INC permanece aberto e o repositório permanece privado por tempo
indeterminado. Não existe publicação parcial ou provisória.

## Escopo

Seis blocos com gate manual entre cada um. Nenhum bloco começa antes do anterior estar
verificado.

### Bloco 0 — Auditoria read-only

Não altera, cria, remove nem commita nada. Produz relatório com severidade 🔴🟠🟡🔵,
`arquivo:linha` ou SHA, e veredito explícito BLOQUEIA / NÃO BLOQUEIA.

- **D1 — Segredos no histórico completo.** A auditoria anterior cobriu apenas até
  `inc-012-pwa-push@46a0122`; os INCs 013–026 nunca foram varridos. `gitleaks detect
  --source . --log-opts="--all"`; `.env*` já adicionado em qualquer commit; buscar chave
  privada VAPID, `CPF_HASH_PEPPER`, `CRON_SECRET`, `APP_DB_PASSWORD`, `POSTGRES_PASSWORD`,
  credenciais MinIO.
- **D2 — Dado pessoal real de terceiro (define o veredito).** Onde o `LocalMediaStorage`
  grava em disco e se esse caminho está ignorado; imagens e CSV/XLSX adicionados em
  qualquer commit; os 40 maiores blobs do histórico; qualquer captura de tela de sistema
  de terceiro em `docs/` ou `public/`.
- **D3 — Vínculo com empresa real.** Inventário completo dos termos do Apêndice A, com
  listas **separadas** para HEAD e para histórico, incluindo mensagens de commit e nomes
  de arquivo. Avaliar se `auditoria-usabilidade-2026-07.md` identifica o fornecedor mesmo
  sem o nome.
- **D4 — Infra exposta.** IP/host/domínio de VPS, URLs de túnel cloudflared, portas
  internas, credenciais em `.yml` versionado.
- **D5 — Documentação enganosa.** `docs/README.md` declara "Status geral: 📐 Fase de
  especificação (nenhuma linha de código escrita)" — seria a primeira frase lida num repo
  com 26 INCs entregues. Listar todo doc cujo status divirja do estado real; INCs sem
  Relatório de Entrega; roadmap desatualizado.

**Gate:** relatório revisado pelo Pedro. Achado 🔴 ou PII de terceiro suspende o INC até
replanejamento.

#### Bloco 0b — Addendum (lacunas reveladas pela execução do Bloco 0)

1. **`gitleaks` executado de fato.** A primeira passada foi manual porque a ferramenta não
   estava instalada. D1 não fecha em varredura manual.
2. **D3b — identificadores derivados.** A lista de termos original foi montada a partir de
   *nomes de empresa* e por isso não capturou um domínio de e-mail real do piloto em
   `.env.example` (`VAPID_SUBJECT`). Segunda passada específica para: domínio de e-mail,
   CNPJ, telefone, endereço de filial, nome de bairro real, padrão de matrícula, site e
   perfis sociais do cliente, nome do ERP legado.
3. **Inventário completo de refs.** `git branch -a`, `git tag`, `git stash list`,
   `git for-each-ref`. O `filter-repo --all` processa todas as refs alcançáveis — uma
   branch local esquecida ou um stash reintroduz tudo depois da reescrita.
4. **Decisão registrada:** o relatório forense do Bloco 0 **não é versionado**. Um repo
   público contendo relatório detalhado sobre a remoção da identidade de um cliente é
   sinalização para o que se quer justamente não sinalizar. A versão forense fica fora do
   repositório; uma versão sanitizada — método, cobertura e resultado, sem detalhe de
   achado — pode ser versionada e é positiva para o portfólio.

### Bloco 1 — Backup e rotação de credenciais

1. `git bundle create ~/backups/conecta-original-$(date +%F).bundle --all` — cópia
   completa e verificável do repositório original, guardada **fora do GitHub**. Verificar
   com `git bundle verify`. **Executar antes de qualquer exclusão de branch**, para que o
   backup preserve o estado real.
2. **Excluir a branch `chore/seed-senha-padrao`** (`git branch -D`), nunca enviada ao
   remoto. O script que reseta a senha de todos os usuários do tenant para valor fixo via
   role owner, sem guarda, não deve existir em ref alguma — vale independentemente da
   publicação, porque contorna a role de runtime e a RLS que o ADR-003 sustenta. A decisão
   registrada em **DP-27** permanece no vault; o código não. Excluir antes do Bloco 2:
   `filter-repo --all` reescreveria e preservaria essa branch em vez de descartá-la.
3. Rotação de **todas** as credenciais, independentemente do resultado do Bloco 0 (custo
   baixo, certeza alta): par de chaves VAPID, `CPF_HASH_PEPPER`, `CRON_SECRET`, senha da
   role `conecta_app`, `POSTGRES_PASSWORD`, credenciais MinIO.
4. Consequência conhecida da troca de VAPID: todas as subscriptions de push existentes
   deixam de valer e os dispositivos precisam reinscrever. Sem impacto — não há usuário
   real ainda.
5. Consequência conhecida da troca de `CPF_HASH_PEPPER`: os `cpf_hash` existentes deixam
   de resolver. Sem impacto no banco de dev (recriado pelo seed do Bloco 3).
   **Entregável:** `docs/03-LGPD/rotacao-de-pepper.md`, escrito a partir da execução real
   desta rotação — passo a passo, impacto em base com dados reais (todo login por CPF
   quebra até o re-hash), por que não é reversível e como o re-hash seria feito se houvesse
   dados. É o procedimento de emergência que o ADR-006 exige e que nunca foi escrito; a
   rotação deste bloco é a oportunidade de documentá-lo sem risco.

### Bloco 2 — Reescrita de histórico

1. `git filter-repo --replace-text` com o expressions file do Apêndice B (conteúdo de
   arquivos) e `--replace-message` com o mesmo arquivo (mensagens de commit).
2. `--path-rename` para arquivos cujo **nome** contenha termo vinculante.
3. `--invert-paths --path` para remover binários que `--replace-text` não alcança. Alvos
   confirmados pela auditoria:
   - `docs/06-Design/redesenho-prints/*.png` — capturas com nome do tenant real, logotipo e
     slug visível na URL (path-based, ADR-010), além dos dez nomes de pessoa da questão P1.
     Saem **independentemente** da resposta de P1: mesmo com nomes fabricados, a marca e o
     slug reais estão renderizados na imagem. Substituídas por capturas novas do seed Vale
     Verde no Bloco 4.
   - `public/branding/logo.png` e `public/branding/favicon.png` — logotipo real do cliente,
     servido pela aplicação hoje. Exige ativo substituto (Bloco 3).
   - Qualquer CSV/XLSX de import real, se o Bloco 0b confirmar existência.
4. **Consertar referências órfãs.** Remover caminhos por `--invert-paths` deixa links e
   embeds quebrados em markdown do vault. Varrer o HEAD por referências aos caminhos
   removidos e corrigi-las no mesmo commit `docs:` do passo seguinte.
5. Script que lê `.git/filter-repo/commit-map` e reescreve todas as referências de SHA nos
   Relatórios de Entrega dos INCs, em um commit `docs:` final.

**Nota de método:** `--replace-text` atua sobre conteúdo de blob de texto. Não renomeia
caminhos, não altera binários e não altera mensagens de commit — cada um exige a flag
própria acima. Ignorar isso produz falso sucesso.

### Bloco 3 — Seed de demonstração (Rede Vale Verde)

Não é limpeza; é feature de portfólio e insumo futuro de onboarding/treinamento.

- Tenant **Rede Vale Verde**, slug `vale-verde`, 3 filiais com nomes genéricos (Centro,
  Zona Norte, Distrito Industrial).
- ~40 colaboradores mantendo os rótulos genéricos atuais (`Colaborador 0-1`), distribuídos
  entre os papéis (DP-38 resolvida em 2026-08-12); avatares sintéticos gerados
  (boring-avatars / DiceBear) — **zero foto de pessoa real**. O README da raiz declara
  explicitamente que se trata de seed sintético, para que o rótulo genérico leia como
  deliberado e não como dado faltando.
- ~15 comunicados verossímeis com categorias e criticidades variadas, incluindo
  agendados e arquivados.
- **Acks parciais**, de modo que o painel de pendências exiba percentual intermediário
  (~60–70%) em vez de 0% ou 100% — é a tela que demonstra o núcleo do produto.
- Feed povoado, vagas abertas com candidaturas, aniversários distribuídos ao longo do ano.
- **Ativos visuais substitutos** (pré-requisito da remoção do branding real no Bloco 2):
  wordmark simples de Rede Vale Verde e favicon correspondente, em `public/branding/`,
  seguindo a paleta da direção Balcão do `design-system.md`. Não precisa ser elaborado —
  precisa existir e ser coerente, porque aparece em toda captura de tela.
- Credenciais de demonstração documentadas no README da raiz.

### Bloco 4 — Vitrine

- **README da raiz:** problema → tese jurídica (trilha de auditoria com valor probatório)
  → arquitetura → o que é tecnicamente difícil aqui → como rodar em ≤5 comandos →
  credenciais de demo. Screenshots do seed Vale Verde.
- **`docs/README.md`:** status real, substituindo a declaração de "nenhuma linha de código
  escrita". Índice do vault com o mapa ADR/INC/DP.
- Roadmap e Relatórios de Entrega pendentes atualizados (achados D5).
- Diagrama do isolamento multi-tenant.

### Bloco 5 — Travas

- Hook de pre-commit com `gitleaks` (bloqueio real, coerente com
  `claude-code-boas-praticas.md`: o inegociável vira hook, não linha de `CLAUDE.md`).
- Valores de CI migrados para GitHub Secrets (achado A7-4 da auditoria de julho).
- Regra de revisão: nenhum commit que introduza nome de empresa real.

### Bloco 6 — Publicação

1. Criar repositório **novo** no GitHub, público, e fazer o push do histórico reescrito.
2. Reconfigurar o CI no repo novo e confirmar verde.
3. Deletar o repositório antigo — apenas após o bundle do Bloco 1 estar verificado e o
   novo repo estar funcional. Deletar remove também os logs de execução do Actions, que a
   reescrita de histórico não alcança.
4. Perfil do GitHub: repo fixado; link inserido no CV.

## Fora do escopo

- Demo online em VPS → **DP-37** (sem VPS contratado).
- MinIO em produção, consolidação de upload, anonimização de desligados → caminho crítico
  do piloto, não deste INC.
- Qualquer feature de produto.
- Reescrita do currículo (trabalho paralelo, fora do vault).

## Critérios de aceite

- [ ] `grep` dos termos do Apêndice A retorna zero em HEAD, **e** `git log -S "<termo>"
      --all` retorna zero para cada termo, **e** `git log --all --format=%B | grep -i` retorna
      zero (mensagens de commit), **e** nenhum nome de arquivo no histórico contém termo.
- [ ] `gitleaks detect --log-opts="--all"` limpo.
- [ ] Nenhuma imagem, CSV ou XLSX com dado pessoal real de terceiro em qualquer commit.
- [ ] Todo SHA citado em Relatório de Entrega resolve no repo novo (`git cat-file -e <sha>`
      para cada um).
- [ ] Em máquina limpa, seguindo **apenas** o README: `docker compose up -d && npm run
      db:seed && npm run dev` sobe o app povoado com Rede Vale Verde e permite login com as
      credenciais documentadas.
- [ ] Painel de pendências exibe percentual intermediário com o seed novo.
- [ ] `npm run lint && npm run typecheck && npm run build && npm run test` verdes no CI do
      repositório novo.
- [ ] Hook de pre-commit **testado de verdade**: um segredo plantado deliberadamente é
      bloqueado.
- [ ] `docs/README.md` não declara mais "nenhuma linha de código escrita".
- [ ] Bundle offline verificado (`git bundle verify`) antes de o repo antigo ser deletado.
- [ ] Repositório antigo deletado.
- [ ] Nenhum arquivo `LICENSE` presente.
- [ ] `docs/03-LGPD/rotacao-de-pepper.md` escrito a partir da rotação real do Bloco 1.
- [ ] Autorização explícita do Pedro registrada **antes** de o Bloco 6 começar.

## Riscos

- **Reescrita de histórico é destrutiva e não se desfaz** — mitigado pelo bundle do Bloco 1
  e pela verificação de SHAs antes do Bloco 6.
- **Falso-negativo de `grep`** — termos como "grão" são palavras comuns em português;
  revisar hits um a um em vez de confiar em contagem zero.
- **Falso sucesso do `filter-repo`** — sem `--replace-message`, `--path-rename` e
  `--invert-paths`, o nome sobrevive em mensagens, caminhos e binários.
- **Identificação por cruzamento** — o CV vincula o autor publicamente ao empregador e à
  cidade. Manter setor + localidade no repo reconstrói o vínculo sem citar o nome. Ver
  Apêndice A.

## Pendências criadas

- **DP-37** — Demo online pública em VPS com seed Vale Verde e reset diário por cron.
  Bloqueada até contratação de infra.
- ~~**DP-38** — Nomes de colaborador no seed.~~ **Resolvida (2026-08-12):** mantém os
  rótulos genéricos (`Colaborador 0-1`); o README declara o seed como sintético.

## Registro de conclusão

*(a preencher ao final — data, branch, commit de merge, decisões tomadas durante a
execução, desvios do plano)*

---

## Apêndice A — Tabela de substituição

| De | Para | Nota |
|---|---|---|
| Nome do cliente piloto (todas as grafias, com e sem acento, siglas) | Rede Vale Verde | |
| Slug `vale-verde` | `vale-verde` | **aparece na URL** (ADR-010), logo em toda screenshot |
| Nome do fornecedor do portal legado | "portal legado" / "sistema legado do fornecedor" | |
| Nome do ERP legado | "ERP legado" | |
| Filiais com nome de bairro real | Centro / Zona Norte / Distrito Industrial | bairro real vincula tanto quanto o nome da empresa |
| Cidade e estado (interior do RJ-RJ) | remover | **identificador mais forte que sobra** — cruzamento com o CV |
| Setor específico ("supermercado") | "varejo com operação multi-filial" | mantém a narrativa de problema real; remover por completo custaria valor de portfólio |
| IP / host / domínio de VPS, URL de túnel | remover; só via env | |
| **Pedro Catrinck** | **manter** | assinatura dos ADRs; é o portfólio |

**Identificadores derivados** — classe que a lista original não previa e que a execução do
Bloco 0 revelou (domínio de e-mail real em `VAPID_SUBJECT`, no `.env.example`). Rastrear e
substituir por valor fictício ou remover: domínio de e-mail, CNPJ, telefone, endereço de
filial, nome de bairro real, padrão de matrícula, site institucional e perfis sociais do
cliente. Vínculo não depende de o nome aparecer.

## Apêndice B — Expressions file do `filter-repo`

Formato: `literal==>substituto`, uma por linha. **Ordem importa** — expressões mais longas
e específicas primeiro, para evitar substituição parcial. Cobrir variações com e sem
acento, maiúsculas, siglas, slug e forma possessiva. O arquivo definitivo é montado a
partir do inventário do Bloco 0 / D3, e **não é versionado** (contém os termos que se
quer eliminar).
