# ADR-012 — Repositório público com desvinculação total de empresa real

**Status:** **Aceito em:** 2026-08-12 (Pedro Catrinck)
**Data:** 2026-08-12
**Decisores:** Pedro Catrinck

## Contexto

Fatos que motivam a decisão:

1. **O piloto está pausado, não cancelado.** Caminho crítico bloqueado por dependências
   externas e de custo: VPS não contratado (logo MinIO em produção não anda, e todas as
   features de imagem seguem no `LocalMediaStorage` mock), ciclo de anonimização de
   desligados inexistente (auditoria 2026-07, A3-1, 🟠 ALTO, obrigatório antes de dado
   real), aviso de privacidade ainda exibindo `PENDENTE-JURÍDICO` ao usuário final, e
   contrato operador↔controladora dependente de advogado.
2. **O currículo cita o Conecta como projeto principal, sem link funcional.** O repo é
   privado desde o INC-001 (`pedromcatrinck/conecta`); o perfil público do GitHub não
   evidencia nada. O projeto de maior valor técnico é o único item do CV sem link.
3. **Publicar é irreversível.** No momento em que o repositório vira público, há
   indexação por buscadores, clones, forks e arquivamento por terceiros. Reverter para
   privado não desfaz o que foi capturado.
4. **O vault referencia empresas reais nominalmente.** Cliente piloto (supermercado onde
   o autor é funcionário), fornecedor do portal legado e ERP legado aparecem por nome em
   ADRs, INCs, auditorias, `personas.md`, `design-system.md`, seed (`prisma/seed-data.ts`)
   e no slug de tenant — que, por ser resolução path-based (ADR-010), aparece na URL de
   toda captura de tela. A auditoria de usabilidade descreve em detalhe telas de produto
   de terceiro.
5. **A última auditoria de segredos cobriu apenas até `inc-012-pwa-push@46a0122`.** Os
   INCs 013 a 026 introduziram VAPID, credenciais MinIO, docker-compose de produção,
   host de VPS e túneis cloudflared — nunca auditados no histórico.

## Decisão

**O repositório do Conecta passa a ser público e continua sendo o repositório de trabalho
do produto, após desvinculação total e irreversível de qualquer empresa real.**

Seis partes:

1. **Publicar é consequência, não substituto do piloto.** O produto segue em
   desenvolvimento no mesmo repo. Não há fork, espelho sincronizado à mão nem snapshot
   congelado — as duas primeiras vazam por erro humano, a terceira apodrece e passa a
   sinalizar projeto abandonado.
2. **Tolerância zero de vínculo.** Nenhuma menção a empresa real em: conteúdo de arquivo,
   mensagem de commit, nome de arquivo, imagem, dado de seed, slug de tenant ou log de
   CI — em nenhum ponto do histórico. Tenant de demonstração: **Rede Vale Verde**, slug
   `vale-verde`.
3. **Histórico reescrito** com `git-filter-repo`. As referências de SHA nos Relatórios de
   Entrega (INC-002 `73a01a3`, INC-006 `a28269e`, INC-008 `550a7f8`, e demais) são
   corrigidas a partir do `commit-map` gerado pela ferramenta, em um commit `docs:` final —
   preservando o elo documentação↔commit, que é parte do valor do vault.
4. **Publicação em repositório novo; o atual é deletado após backup offline.** Force-push
   sobre o repo existente é rejeitado (ver Alternativas).
5. **Sem arquivo `LICENSE`.** Ausência de licença = todos os direitos reservados por
   padrão: terceiros podem ler e avaliar (o objetivo), não podem usar comercialmente.
6. **A suíte de testes é preservada integralmente.** Isolamento RLS multi-tenant, N
   publicações concorrentes sem duplicata de numeração, imutabilidade de ack verificada
   até contra a role owner e `grants-matrix.test.ts` são o principal ativo demonstrável do
   projeto. Remover testes para "limpar" o repo destruiria exatamente o diferencial.

## Alternativas consideradas

- **Repo público derivado + repo privado como fonte de verdade** — rejeitada: dois repos
  divergem, sincronização manual é o vetor clássico de vazamento, e o público apodrece.
- **Troca de nome só no HEAD, sem reescrever histórico** — rejeitada por decisão explícita
  do Pedro (2026-08-12: nenhuma menção "em nenhum documento, nem log"). Cobriria os
  vetores realistas (GitHub Code Search e buscadores indexam apenas o branch padrão), mas
  `git log -S "<nome>" --all` continuaria devolvendo tudo.
- **Force-push do histórico reescrito sobre o repositório atual** — rejeitada por três
  razões técnicas: (a) commits desreferenciados permanecem acessíveis por SHA direto no
  GitHub por tempo indeterminado; (b) os logs de execução do GitHub Actions de 26 INCs não
  são tocados por reescrita de histórico, e o CI roda `prisma db seed` — o nome do tenant
  real provavelmente aparece em saída de teste ou de erro; (c) PRs e issues eventuais
  preservam conteúdo antigo.
- **Squash total / orphan branch com commit inicial único** — rejeitada: descartaria 26
  INCs de histórico com Conventional Commits, uma branch por incremento e merges `--no-ff`.
  Esse histórico *é* o portfólio; um repo com um único commit inicial não demonstra método.
- **Licença MIT** — rejeitada: doaria um produto comercial pausado, permitindo que
  qualquer pessoa o venda como próprio.

## Consequências

**Positivas**
- O link do CV passa a existir e a resistir a inspeção técnica.
- Histórico, ADRs, INCs e suíte de testes tornam-se evidência verificável em vez de
  palavra-chave.
- Auditoria de segredos, rotação de credenciais e seed de demonstração eram dívida do
  piloto de qualquer forma — cerca de 80% do trabalho serve aos dois objetivos.
- Commits contínuos em repo público ativo são sinal que nenhum README compra.

**Negativas e dívidas assumidas**
- Todos os SHAs mudam. Qualquer clone local existente fica órfão e deve ser descartado;
  o remoto precisa ser recriado.
- O código do produto passa a ser legível por qualquer pessoa. Aceito: em SaaS B2B de
  nicho, o fosso é operar a infraestrutura, atender o cliente e assumir responsabilidade
  LGPD — não o código.
- Cerca de um dia e meio de trabalho é portfólio puro (vitrine, screenshots) e não avança
  o piloto.
- Cada commit futuro passa a ser uma chance de vazar segredo ou nome. Mitigação
  obrigatória: hook de pre-commit com varredura, não instrução em `CLAUDE.md` — coerente
  com a regra do próprio vault de que o inegociável vira trava, não texto.
- **Desvinculação por nome não é anonimato.** O CV vincula publicamente o autor ao
  empregador e à cidade; o repo o vincula ao Conecta. Detalhes de setor + localidade no
  material público reconstroem o vínculo por cruzamento. Ver INC-027 para o tratamento.

## Gatilho de revisão

- **Bloco 0 encontrar PII real de terceiro** (foto de pessoa, CSV com CPF real) ou captura
  de tela de produto de terceiro no histórico → a reescrita deixa de ser preferência e
  passa a ser obrigação legal; o escopo do INC-027 cresce e a publicação fica bloqueada
  até a remoção ser verificada.
- **Piloto retomado com autorização formal e contrato** → reavaliar o que passa a ser
  commitado (a publicação em si não é reversível).
- **Segundo cliente pagante ou venda real** → avaliar mover o desenvolvimento para repo
  privado novo, mantendo o público como marco histórico congelado e explicitamente datado.
