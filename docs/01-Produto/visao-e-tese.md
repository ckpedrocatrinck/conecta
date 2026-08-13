# Visão e Tese do Produto

## Problema

PMEs brasileiras com força de trabalho operacional (varejo, indústria leve, logística) precisam comunicar normas internas, celebrar pessoas e divulgar oportunidades — e hoje fazem isso com ferramentas que falham em três pontos:

1. **Compliance frágil.** Comunicados são imagens escaneadas; a "ciência" do colaborador é um botão dispensável. Em ação trabalhista, a empresa não consegue provar de forma robusta que o colaborador foi informado.
2. **Custo de alimentação alto.** Os sistemas exigem que o RH produza conteúdo (cartazes no Canva subidos como imagem) em vez de ajudá-lo. Resultado: sistema vazio → colaborador não volta → sistema mais vazio (ciclo vicioso observado no portal legado).
3. **Experiência ruim no celular.** O usuário final é operacional, sem desktop, usando o próprio smartphone. As ferramentas legadas são web desktop adaptada.

## Tese

> O núcleo pelo qual a empresa **paga** é a trilha de auditoria de comunicação (comunicar → garantir ciência → provar ciência). O restante — feed social, aniversariantes, vagas, benefícios — é a camada que dá ao colaborador motivo de **entrar todo dia**, o que por sua vez alimenta o núcleo.

Diferenciais em ordem de prioridade:

1. **Comunicado como entidade nativa** (texto estruturado, não imagem): pesquisável, versionado, com confirmação de leitura timestampada e painel de pendências por filial.
2. **Menor caminho entre "RH tem uma informação" e "conteúdo publicado e bonito"**: templates visuais automáticos no MVP; assistência por IA como camada plugável posterior (ADR-004).
3. **Mobile-first de verdade** (PWA instalável com push).
4. **LGPD by design** como argumento de venda, não retrofit.

## Estratégia de entrada

- **Piloto:** Rede Vale Verde (interior do RJ), substituindo o portal legado. Acesso privilegiado do fundador como funcionário/usuário real.
- **Pré-condição do piloto:** acordo formal com a diretoria garantindo que a propriedade intelectual do produto é do fundador e que a empresa atua como cliente-piloto. ⚠️ Ver `05-Decisoes-Pendentes.md` — isto é bloqueante antes de qualquer deploy interno.
- **Case alvo:** métricas de adoção e depoimento do RH para venda às próximas empresas da região.

## O que este produto NÃO é (por decisão)

- Não é rede social corporativa completa (sem chat 1:1, sem feed aberto de postagem por colaborador no MVP).
- Não é LMS completo (certificados e trilhas de curso são fase 2; o MVP cobre ciência crítica via quiz de comunicado).
- Não é intranet genérica/wiki.

## Métricas de sucesso do piloto (90 dias após go-live)

| Métrica | Alvo |
|---|---|
| Colaboradores ativos/mês (abriram o app) | ≥ 60% da base |
| Taxa de confirmação de comunicados críticos em 7 dias | ≥ 90% |
| Tempo médio do RH para publicar um comunicado | < 5 min |
| Depoimento formal do RH para uso comercial | Obtido |
