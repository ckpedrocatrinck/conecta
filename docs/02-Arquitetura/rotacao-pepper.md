# Rotação do pepper do `cpf_hash` — procedimento de emergência

**Relaciona-se com:** ADR-006 (auth por CPF; `cpf_hash` = hash determinístico com pepper).
**Status:** procedimento operacional (não é ADR). Exigido pelo checklist LGPD (§Segurança).
**Origem:** G6 da auditoria de conformidade (`docs/00-Processo/auditoria-conformidade-lgpd-2026-07.md`).

> O ADR-006 (§ "Consequências") já previa esta necessidade desde julho: "`cpf_hash`
> determinístico também precisa de rotação de pepper documentada como procedimento
> de emergência." Este documento fecha essa pendência. **Consolidado em 2026-08-13**
> (INC-027) a partir de dois rascunhos que nasceram em paralelo — este arquivo
> (runbook operacional) e um segundo em `docs/03-LGPD/rotacao-de-pepper.md`, hoje
> removido — porque é decisão/procedimento arquitetural (ADR-006), não item de
> conformidade LGPD por si só.

## O que é o pepper e por que rotacionar

O CPF nunca é gravado em claro. O login localiza o usuário por
`cpf_hash = HMAC-SHA256(CPF_HASH_PEPPER, cpf_normalizado)` — determinístico, com o pepper
vindo **só** da env `CPF_HASH_PEPPER` (`src/lib/crypto/cpf-hash.ts`), nunca do banco nem do
repositório. O pepper é o segredo que impede um atacante que capture só o banco de rodar um
ataque de dicionário sobre os `cpf_hash` (CPF tem baixa entropia — 11 dígitos —, então sem o
pepper os hashes seriam quebráveis por força bruta). Consequência direta: **o pepper precisa
ser tratado como segredo crítico**, no mesmo nível de uma chave de assinatura — comprometê-lo
não expõe CPFs diretamente (ainda exige uma lista de candidatos para o ataque de dicionário),
mas destrói a garantia de que `cpf_hash` é opaco.

**Rotacionar quando:**
- Suspeita ou confirmação de **vazamento do pepper** (env exposta, commit acidental, acesso
  indevido ao secret manager).
- Saída de pessoa com acesso ao secret de produção (higiene) — hoje, no piloto, é
  administração de infraestrutura; a lista cresce quando a equipe crescer.
- Exigência de política/auditoria — inclusive contratual (cliente/parceiro exigindo rotação
  periódica de segredos como condição de continuidade).
- **Preparação para exposição do repositório/infra** onde o valor antigo, mesmo que nunca
  tenha sido commitado em claro, não pode mais ser considerado confiável por precaução (foi o
  gatilho do INC-027).

## ⚠️ Limitação fundamental (leia antes de tudo)

**Não é um "re-hash" simples.** Como o `cpf_hash` é unidirecional (HMAC) e **não guardamos o
CPF em claro**, é **impossível** recomputar os hashes existentes com um pepper novo a partir do
que está no banco. Trocar o pepper **invalida todos os `cpf_hash` atuais de uma vez** — nenhum
usuário é mais encontrável no login até que os hashes sejam regenerados **a partir dos CPFs de
origem**. Qualquer procedimento abaixo depende de **re-obter os CPFs** (fonte: RH/CSV de
importação, ou o próprio usuário digitando de novo no login) — isto é uma constatação honesta
do desenho atual, não uma falha a "consertar" aqui.

Com dados reais, isso torna a rotação um **evento de invalidação total de autenticação por
CPF** para todos os tenants, imediatamente após a troca — não uma troca de variável trivial. A
única forma de recuperar acesso é re-obter o CPF (em lote, via RH, ou individualmente, via
login) e recalcular `hash(cpf, pepper_novo)` a partir dele.

## Opções reais de rotação

### Opção A — Re-importação (recomendada quando há a fonte; é a que casa com o código hoje)
Pré-condição: acesso ao CSV/fonte de RH com os CPFs de todos os colaboradores ativos.
1. Colocar o sistema em **manutenção** (login indisponível) e avisar o RH/contato.
2. Definir o **novo** `CPF_HASH_PEPPER` no secret manager (NÃO apagar o antigo ainda).
3. Rodar, **por tenant** e numa transação, a re-importação que recalcula `cpf_hash` de cada
   usuário com o pepper novo (reusar o caminho de import de colaboradores do INC-003; casar por
   `registrationCode`/matrícula, que não depende do pepper). Não tocar senha/`mustChangePassword`.
4. Validar (contagem de usuários re-hasheados = ativos; um login de teste por tenant).
5. Sair da manutenção. Manter o pepper antigo guardado até a validação fechar (ver Rollback).

**Por que esta é a opção que corresponde ao comportamento real do código hoje:** reaproveita o
caminho de import CSV que já existe desde o INC-003 — nenhuma linha de código nova, só rodar o
fluxo existente com o pepper novo. As duas alternativas abaixo (Opção B e a variante descartada)
exigem escrever código que não existe hoje.

### Opção B — Transição com pepper duplo (janela sem re-importar, sem exigir CSV de RH)
Quando não há re-importação imediata viável e o objetivo é não derrubar o login. **Ainda não
implementada** — é o desenho a seguir se for priorizada:
1. Introduzir suporte a **dois peppers** (env `CPF_HASH_PEPPER` novo + `CPF_HASH_PEPPER_PREVIOUS`
   antigo) — mudança de código temporária: no login, tentar casar o `cpf_hash` com o pepper
   novo e, se não achar, com o antigo.
2. **Ponto-chave que simplifica esta opção:** o login do Conecta já pede **CPF completo** como
   credencial (ADR-006) — não é preciso nenhum "segundo fator" nem tela de recuperação
   separada. O CPF que o usuário digita na tentativa de login (mesmo a que falhou contra o
   pepper novo) já é exatamente o dado necessário para recalcular o hash com o pepper antigo e
   achar a linha certa. Se bater, valida a senha normalmente contra `password_hash` (que não
   depende do pepper) e, **no mesmo request**, regrava `cpf_hash` com o pepper novo — migração
   silenciosa, sem UI nova, sem pedir nada além do que o login já pede.
   > Uma versão anterior deste procedimento (rascunho hoje removido, `docs/03-LGPD/`) descrevia
   > isto como um fluxo de "recuperação pós-rotação" com "CPF + um segundo fator" — essa
   > premissa estava errada: não existe CPF "perdido" para recuperar, porque o login já exige
   > CPF a cada tentativa. A correção acima é mais simples que o rascunho original.
3. Usuários migram conforme fazem login. Após uma janela (ex.: 1 ciclo de folha), tratar os
   **stragglers** que nunca logaram via re-importação (Opção A) para eles.
4. Remover o `CPF_HASH_PEPPER_PREVIOUS` e o código de transição só depois que ~100% migraram.
   - **Atenção de segurança:** durante a janela, o pepper antigo continua "vivo" no sistema —
     se a rotação foi por **vazamento do antigo**, a Opção B **não mitiga** o vazamento até a
     janela fechar. Nesse caso, prefira a Opção A (invalidação imediata).

## Emergência por VAZAMENTO do pepper (caminho crítico)
Se o pepper antigo vazou, o objetivo é **invalidá-lo o quanto antes**:
1. Rotacionar o secret **já** (novo pepper) — isso quebra o login (esperado).
2. Re-importar (Opção A) o mais rápido possível a partir da fonte de RH; login fica
   indisponível no intervalo. Comunicar o incidente conforme a política de resposta.
3. **Não** usar a Opção B aqui (mantém o pepper vazado utilizável durante a janela).

## Impacto
- **Login indisponível/instável** entre a troca do pepper e o fim da regeneração dos hashes
  (Opção A) — planejar em janela de baixo uso e avisar o RH.
- Sessões já abertas continuam válidas (a sessão é server-side e não depende do `cpf_hash`);
  só **novos logins** são afetados. Nenhum outro dado é impactado (o pepper só entra no `cpf_hash`).

## Rollback

**Durante uma rotação planejada e controlada:**
- **Nunca apague o pepper antigo** até confirmar que o novo funciona (login de teste por tenant OK).
- Se a regeneração falhar no meio, **reverter a env para o pepper antigo** restaura o login
  imediatamente (os `cpf_hash` antigos voltam a casar), desde que a Opção A ainda não tenha
  sobrescrito parte dos hashes. Se sobrescreveu parcialmente, é preciso concluir a Opção A com o
  pepper novo (rollback deixa de ser possível para os já migrados) — por isso a Opção A roda
  **por tenant em transação** e valida antes de seguir para o próximo.

**Depois de um vazamento confirmado, reverter não desfaz o dano.** Se a rotação foi motivada por
suspeita/confirmação de vazamento, voltar ao pepper antigo **não anula o comprometimento**: o
atacante já teve a janela de tempo em que o pepper era válido para rodar um ataque de dicionário
offline contra `cpf_hash` capturados, e reverter reintroduz o mesmo valor comprometido,
anulando o propósito da rotação. Por isso a rotação por vazamento é sempre **para um valor
novo**, nunca um rollback — os hashes gerados sob o pepper comprometido devem ser tratados como
permanentemente não confiáveis, mesmo que o valor antigo seja reaplicado depois.

## Mitigação futura (fora do escopo deste procedimento)
A rotação seria indolor (sem re-importar nem depender do próximo login) se existisse um **cofre
reversível de CPF** separado do hash (ex.: coluna cifrada AES-GCM), permitindo recomputar os
hashes internamente. Isso é justamente o **gatilho de revisão do ADR-006** ("integração com
folha/ERP exigir CPF recuperável em claro → campo separado cifrado, decisão nova"). Enquanto
essa decisão não for tomada, a rotação depende da re-obtenção dos CPFs, como acima.

---

## Execução real — INC-027, Bloco 1 (2026-08-12)

A primeira execução real deste procedimento aconteceu no INC-027 (Bloco 1), como parte da
preparação do repositório para publicação — sem nenhum dado real no banco naquele momento, o
que tornou a rotação de custo zero:

- O banco de dev usado até aqui só tinha dados de seed/teste (CPFs fictícios no padrão
  `1000000000x`, documentados como tal em vários INCs).
- Não há piloto com dados reais em produção ainda (ADR-012, contexto: "o piloto está pausado,
  não cancelado").
- O volume de banco de dev foi destruído e recriado do zero pelo seed (`docker compose down -v`
  + seed do Bloco 3 do INC-027) — não havia usuário real para quebrar login.

Ou seja: esta rotação trocou o segredo **antes de existir qualquer dado que dependesse dele**,
a janela em que trocar pepper é trivial. A partir do primeiro cliente real em produção, qualquer
rotação futura paga o custo completo descrito nas seções acima — e a simplificação da Opção B
(seção anterior) precisa estar implementada **antes** desse momento, não depois, se for a
abordagem escolhida.
