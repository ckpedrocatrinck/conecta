# Rotação de `CPF_HASH_PEPPER` — procedimento de emergência (ADR-006)

> O ADR-006 (§ "Consequências") já previa esta necessidade desde julho:
> "`cpf_hash` determinístico também precisa de rotação de pepper documentada
> como procedimento de emergência." Este documento fecha essa pendência.
> A primeira execução real deste procedimento aconteceu no INC-027 (Bloco 1,
> 2026-08-12), como parte da preparação do repositório para publicação — sem
> nenhum dado real no banco naquele momento, o que tornou a rotação de custo
> zero (ver seção final).

## O que é o pepper e por que ele existe

`ADR-006` define que o CPF nunca é armazenado em claro: o login busca o
usuário por `cpf_hash`, um **hash determinístico com pepper de aplicação**
(`CPF_HASH_PEPPER`, variável de ambiente/secret manager — nunca no banco,
nunca no repositório). Determinístico significa: o mesmo CPF sempre produz o
mesmo hash, o que é exigido para a busca de login funcionar (`WHERE cpf_hash
= hash(cpf_digitado, pepper)`), mas também significa que **o pepper é a
única coisa que separa `cpf_hash` de um hash burro sem sal** — quem tem o
pepper e uma lista de CPFs candidatos (CPF não é segredo, é documento
público) pode recalcular e comparar.

Consequência direta: **o pepper precisa ser tratado como segredo crítico**,
no mesmo nível de uma chave de assinatura. Comprometer o pepper não expõe
CPFs diretamente (ainda precisa de uma lista de candidatos para o ataque de
dicionário), mas destrói a garantia de que `cpf_hash` é opaco.

## Quando a rotação é exigida

- **Comprometimento suspeito ou confirmado** do valor do pepper (log
  exposto, variável de ambiente vazada, secret manager comprometido).
- **Saída de qualquer pessoa com acesso ao segredo** (hoje, no piloto, é
  administração de infraestrutura — lista cresce quando a equipe crescer).
- **Exigência contratual ou de auditoria** (ex.: cliente/parceiro exige
  rotação periódica de segredos como condição de continuidade).
- **Preparação para exposição do repositório/infra** onde o valor antigo,
  mesmo que nunca tenha sido commitado em claro, não pode mais ser
  considerado confiável por precaução (foi o gatilho do INC-027).

## Impacto em base COM dados reais — por que isto quebra login

Este é o ponto que faz a rotação ser **operação de emergência**, não rotina:

1. `cpf_hash` é `hash(cpf_normalizado, pepper_atual)`. Trocar o pepper sem
   mais nenhuma ação faz **todo `cpf_hash` existente parar de bater** com
   qualquer CPF recalculado — ninguém consegue logar, para todos os
   tenants, imediatamente após a troca.
2. **Não existe CPF em claro no banco, por desenho** (ADR-006, é o ponto
   central da decisão: "CPF nunca em claro"). Isso significa que **não há
   como re-hash em lote** a partir do que está armazenado — não existe um
   valor de origem para recalcular `hash(cpf, pepper_novo)`. O `cpf_hash`
   antigo não é reversível para obter o CPF (é hash, não criptografia
   reversível), então a aplicação não tem, em nenhum momento depois da
   troca, o dado necessário para reconstruir o vínculo.
3. **Consequência prática:** com dados reais, a rotação do pepper não é
   "trocar uma variável" — é um **evento de invalidação total de
   autenticação por CPF**. A única forma de recuperar acesso é o próprio
   usuário fornecer o CPF de novo (nova tela de login/recuperação), e a
   aplicação recalcula e regrava `cpf_hash` com o pepper novo **naquele
   momento**, por usuário, conforme cada um retorna. Não existe migração de
   banco que resolva isso de uma vez — é reconstrução gradual, guiada pelo
   usuário, não um job de dados.

## Como o re-hash seria conduzido, se houvesse dados reais

Como não há CPF em claro para recalcular em lote, o procedimento tem que
capturar o CPF de novo, no momento do primeiro acesso após a rotação:

1. Trocar `CPF_HASH_PEPPER` no ambiente de produção. A partir daqui, **todo
   login por CPF falha** (comportamento esperado, não é bug).
2. Colocar a tela de login em modo "recuperação de acesso pós-rotação":
   ao falhar o match de `cpf_hash`, oferecer um fluxo que pede CPF + um
   segundo fator já existente e confiável (ex.: senha atual, se ainda for
   validável independentemente do CPF — depende de como a senha é
   indexada; se a senha também for buscada via `cpf_hash`, o segundo fator
   precisa ser outro, como e-mail cadastrado + confirmação, ou reset
   assistido pelo RH/admin do tenant).
3. Ao confirmar identidade por esse segundo fator, recalcular `cpf_hash =
   hash(cpf_informado, pepper_novo)` e gravar, substituindo o hash antigo
   para aquele usuário.
4. Usuários que não retornarem ficam com o `cpf_hash` antigo (órfão, não
   bate com nada) até o próximo acesso — sem risco de segurança adicional
   (o hash antigo é só um valor morto), mas bloqueados até passarem pelo
   fluxo de recuperação.
5. **Comunicação obrigatória antes de rodar em produção com dados reais:**
   avisar todos os tenants ativos de que haverá uma janela de
   indisponibilidade de login, com instrução do fluxo de recuperação — isto
   é rotação de emergência, o aviso é reativo, não uma manutenção
   agendada com folga.

Este fluxo (passos 2-4) **não existe hoje na aplicação** — é trabalho de
implementação a ser feito antes do primeiro cliente real ir ao ar, não algo
que se escreve no meio de um incidente. Registrar como dívida técnica
separada (fora do escopo deste documento, que é o procedimento; a
implementação do fluxo de recuperação é feature).

## Por que não é reversível

Trocar o pepper de volta ao valor antigo **não desfaz o dano de um
comprometimento** — se o pepper vazou, o atacante já teve a janela de tempo
em que ele era válido para fazer o que precisava (ataque de dicionário
offline contra `cpf_hash` capturados). Reverter o pepper também reintroduz
o mesmo valor comprometido, anulando o propósito da rotação. Por isso a
rotação é sempre **para um valor novo**, nunca um rollback — e por isso os
hashes gerados sob o pepper comprometido devem ser tratados como
permanentemente não-confiáveis, mesmo que o valor antigo seja reaplicado.

## Por que esta execução (INC-027, Bloco 1) foi de custo zero

O procedimento acima descreve o caso com dados reais — é o caso caro, que
exige o fluxo de recuperação por usuário. A rotação executada no Bloco 1 do
INC-027 **não teve esse custo** porque:

- O banco de dev usado até aqui só tinha dados de seed/teste (CPFs
  fictícios no padrão `1000000000x`, documentados como tal em vários INCs).
- Não há piloto com dados reais em produção ainda (ADR-012, contexto: "o
  piloto está pausado, não cancelado").
- O volume de banco de dev é destruído e recriado do zero pelo seed
  (`docker compose down -v` + seed do Bloco 3 do INC-027) — não há usuário
  real para quebrar login.

Ou seja: esta rotação trocou o segredo **antes de existir qualquer dado que
dependesse dele**, o que é exatamente a janela em que trocar pepper é
trivial. A partir do primeiro cliente real em produção, qualquer rotação
futura paga o custo completo descrito nas seções acima — e o fluxo de
recuperação por usuário (seção anterior) precisa existir **antes** desse
momento, não depois.
