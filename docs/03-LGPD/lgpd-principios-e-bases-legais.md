# LGPD — Princípios e Bases Legais

> ⚠️ Este documento orienta o desenho do produto. Não substitui parecer jurídico; antes da venda comercial (fase 2), validar com advogado(a) especializado(a) em proteção de dados.

## Papéis (Art. 5º)

- **Controladora:** a empresa cliente (ex.: Rede Vale Verde) — decide por que e como os dados dos SEUS colaboradores são tratados.
- **Operadora:** a plataforma (nós) — trata dados em nome da controladora.
- Consequência de produto: o contrato com cada cliente precisa de **cláusulas de operador** (finalidade, segurança, subcontratados, término). Template contratual = pendência da fase comercial.

## Dados tratados e bases legais propostas

| Dado | Finalidade | Base legal provável |
|---|---|---|
| Nome, matrícula, filial, cargo, papel | Operação do sistema, direcionamento de comunicados | Execução de contrato de trabalho / legítimo interesse |
| CPF (hash determinístico + pepper) | Autenticação (login) | Execução de contrato |
| Registro de ciência (ack + timestamp + hash) | Cumprimento de obrigação legal/trabalhista da controladora; exercício regular de direitos | Obrigação legal / exercício regular de direitos |
| Data de nascimento | Cadastro; exibição de aniversário | Cadastro: contrato. **Exibição pública: consentimento/opt-out** |
| Foto de perfil e fotos em posts | Engajamento interno | **Consentimento** (revogável) |
| Telefone/e-mail pessoais | Contato opcional | Consentimento |
| Candidatura a vaga interna | Processo seletivo interno | Legítimo interesse / procedimentos preliminares de contrato |

## Princípios que viram regra de produto

1. **Minimização:** não coletamos o que não usamos. Sem campo "por precaução".
2. **Transparência:** aviso de privacidade em pt-BR simples, acessível no app antes do primeiro uso (INC de auth exibe no primeiro login).
3. **Finalidade:** dado de aniversário não vira dado de marketing; candidatura a vaga não vira avaliação de desempenho.
4. **Não discriminação e opt-out social:** ninguém é obrigado a aparecer em post/aniversário. Opt-out não pode ter consequência negativa.

## Direitos dos titulares que o produto precisa suportar

- Acesso e correção: tela "Meus dados" + solicitação ao RH (controladora responde; nós instrumentamos).
- Revogação de consentimento (foto, aniversário visível): toggle no perfil, efeito imediato.
- Eliminação: fluxo de desligamento (ver retenção em lgpd-requisitos-tecnicos.md) — com exceção legal: **registros de ciência são mantidos** por obrigação/exercício regular de direitos da controladora durante prazos trabalhistas.

## Ponto de atenção específico do produto

O registro de ciência é simultaneamente a feature principal e o dado mais sensível juridicamente: ele existe PARA ser prova. Retenção longa dele é legítima e desejada pela controladora — mas precisa estar explícita no aviso de privacidade e no contrato de operação.
