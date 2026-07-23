# Rotação do pepper do `cpf_hash` — procedimento de emergência

**Relaciona-se com:** ADR-006 (auth por CPF; `cpf_hash` = hash determinístico com pepper).
**Status:** procedimento operacional (não é ADR). Exigido pelo checklist LGPD (§Segurança).
**Origem:** G6 da auditoria de conformidade (`docs/00-Processo/auditoria-conformidade-lgpd-2026-07.md`).

## O que é o pepper e por que rotacionar

O CPF nunca é gravado em claro. O login localiza o usuário por
`cpf_hash = HMAC-SHA256(CPF_HASH_PEPPER, cpf_normalizado)` — determinístico, com o pepper
vindo **só** da env `CPF_HASH_PEPPER` (`src/lib/crypto/cpf-hash.ts`), nunca do banco nem do
repositório. O pepper é o segredo que impede um atacante que capture só o banco de rodar um
ataque de dicionário sobre os `cpf_hash` (CPF tem baixa entropia — 11 dígitos —, então sem o
pepper os hashes seriam quebráveis por força bruta).

**Rotacionar quando:**
- Suspeita ou confirmação de **vazamento do pepper** (env exposta, commit acidental, acesso
  indevido ao secret manager).
- Saída de pessoa com acesso ao secret de produção (higiene).
- Exigência de política/auditoria.

## ⚠️ Limitação fundamental (leia antes de tudo)

**Não é um "re-hash" simples.** Como o `cpf_hash` é unidirecional (HMAC) e **não guardamos o
CPF em claro**, é **impossível** recomputar os hashes existentes com um pepper novo a partir do
que está no banco. Trocar o pepper **invalida todos os `cpf_hash` atuais de uma vez** — nenhum
usuário é mais encontrável no login até que os hashes sejam regenerados **a partir dos CPFs de
origem**. Qualquer procedimento abaixo depende de **re-obter os CPFs** (fonte: RH/CSV de
importação). Isto é uma constatação honesta do desenho atual, não uma falha a "consertar" aqui.

## Opções reais de rotação

### Opção A — Re-importação (rotação completa, recomendada quando há a fonte)
Pré-condição: acesso ao CSV/fonte de RH com os CPFs de todos os colaboradores ativos.
1. Colocar o sistema em **manutenção** (login indisponível) e avisar o RH/contato.
2. Definir o **novo** `CPF_HASH_PEPPER` no secret manager (NÃO apagar o antigo ainda).
3. Rodar, **por tenant** e numa transação, a re-importação que recalcula `cpf_hash` de cada
   usuário com o pepper novo (reusar o caminho de import de colaboradores; casar por
   `registrationCode`/matrícula, que não depende do pepper). Não tocar senha/`mustChangePassword`.
4. Validar (contagem de usuários re-hasheados = ativos; um login de teste por tenant).
5. Sair da manutenção. Manter o pepper antigo guardado até a validação fechar (ver Rollback).

### Opção B — Transição com pepper duplo (janela sem re-importar, migração preguiçosa)
Quando não há re-importação imediata viável e o objetivo é não derrubar o login:
1. Introduzir suporte a **dois peppers** (env `CPF_HASH_PEPPER` novo + `CPF_HASH_PEPPER_PREVIOUS`
   antigo) — **mudança de código temporária**: no login, tentar casar o `cpf_hash` com o pepper
   novo e, se não achar, com o antigo; ao autenticar via pepper antigo, **regravar** o
   `cpf_hash` com o pepper novo (migração no acesso).
2. Usuários migram conforme fazem login. Após uma janela (ex.: 1 ciclo de folha), tratar os
   **stragglers** que nunca logaram via re-importação (Opção A) para eles.
3. Remover o `CPF_HASH_PEPPER_PREVIOUS` e o código de transição só depois que ~100% migraram.
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
- **Nunca apague o pepper antigo** até confirmar que o novo funciona (login de teste por tenant OK).
- Se a regeneração falhar no meio, **reverter a env para o pepper antigo** restaura o login
  imediatamente (os `cpf_hash` antigos voltam a casar), desde que a Opção A ainda não tenha
  sobrescrito parte dos hashes. Se sobrescreveu parcialmente, é preciso concluir a Opção A com o
  pepper novo (rollback deixa de ser possível para os já migrados) — por isso a Opção A roda
  **por tenant em transação** e valida antes de seguir para o próximo.

## Mitigação futura (fora do escopo deste procedimento)
A rotação seria indolor (sem re-importar) se existisse um **cofre reversível de CPF** separado
do hash (ex.: coluna cifrada AES-GCM), permitindo recomputar os hashes internamente. Isso é
justamente o **gatilho de revisão do ADR-006** ("integração com folha/ERP exigir CPF
recuperável em claro → campo separado cifrado, decisão nova"). Enquanto essa decisão não for
tomada, a rotação depende da re-obtenção dos CPFs, como acima.
