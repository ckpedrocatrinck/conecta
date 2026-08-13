# ADR-001 — Comunicado é entidade nativa versionada, nunca imagem

**Status:** Aceito
**Aceito em:** 2026-07-09 (Pedro Catrinck)
**Data:** 2026-07-09
**Decisores:** Pedro Catrinck

## Contexto
No portal legado, comunicados são imagens escaneadas (com assinatura) embutidas em página web: sem busca, ilegíveis no celular, inacessíveis, impossíveis de versionar. A confirmação "declaro que li e entendi" existe, mas sem vínculo com o conteúdo exato lido nem relatório de pendências utilizável. O valor jurídico do sistema depende de provar QUEM confirmou O QUÊ e QUANDO.

## Decisão
Comunicado é entidade estruturada (título, corpo rich text, categoria, público-alvo, criticidade) com **versionamento imutável**: cada edição pós-publicação gera nova versão com hash de conteúdo; confirmações de ciência gravam usuário, timestamp e hash da versão lida, e são imutáveis pela aplicação.

## Alternativas consideradas
- **Upload de imagem/PDF como o portal legado** — preserva o fluxo atual do RH, mas perpetua todos os problemas; rejeitada.
- **Texto sem versionamento** — mais simples, mas edição pós-confirmação destruiria o valor probatório ("confirmei outra coisa"); rejeitada.
- **Assinatura digital com certificado ICP** — valor probatório máximo, custo e fricção desproporcionais para o caso de uso; rejeitada no MVP (gatilho de revisão: cliente de setor regulado exigir).

## Consequências
+ Busca full-text, acessibilidade, leitura mobile, trilha de auditoria exportável.
+ Base pronta para quiz de ciência (fase 2) e geração por IA (fase 2).
− RH precisa digitar/colar texto em vez de subir cartaz — mitigado pelos templates visuais (ADR-004).
− Migração do histórico do portal legado (imagens) não é 1:1; histórico legado pode entrar como anexo-arquivo morto.

## Gatilho de revisão
Exigência de validade probatória superior (perícia questionar hash simples) → avaliar carimbo de tempo/assinatura qualificada.
