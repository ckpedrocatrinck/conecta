# ADR-006 — Ciclo de vida do usuário e autenticação por CPF

**Status:** Aceito
**Aceito em:** 2026-07-09 (Pedro Catrinck)
**Data:** 2026-07-09
**Decisores:** Pedro Catrinck
**Relaciona-se com:** ADR-001, ADR-003, LGPD

## Contexto
Duas pendências de modelagem estavam marcadas "resolver no INC-002", o que viola o próprio fluxo (decisão de arquitetura = ADR antes de implementar). O kickoff do Claude Code também apontou uma contradição real: o escopo dizia "login por matrícula/CPF parcial", mas o modelo guardava só `cpf_hash` do CPF inteiro — hash é unidirecional, não permite busca por CPF parcial. Pedro confirmou que, na realidade do Vale Verde, os colaboradores usam **CPF** para se identificar (não decoram matrícula).

## Decisão

### 1. Autenticação por CPF
- Login = **CPF completo + senha**. CPF é a credencial de identificação.
- O CPF é normalizado (só dígitos) e armazenado como **hash determinístico com pepper de aplicação** (`cpf_hash`), permitindo busca no login sem nunca guardar o valor em claro.
- Pepper vive em variável de ambiente/secret manager, nunca no banco nem no repositório.
- A senha segue hash próprio (argon2id/bcrypt) — o hash de CPF é para localizar o usuário, não para autenticar; senha é o segredo.
- `registration_code` (matrícula) permanece no cadastro como identificador interno/relatórios, mas **não é credencial de login** no MVP.
- Elimina-se qualquer menção a "CPF parcial" no escopo.

### 2. Leitura de comunicado (`AnnouncementRead`)
- Grava-se **apenas a primeira abertura por versão** de cada comunicado por usuário. Aberturas subsequentes não geram registro novo. Justificativa: o valor probatório está na ciência (`AnnouncementAck`); o "read" serve a UX (marcar como lido) e a métrica leve, não exige log de toda visualização.

### 3. Ciclo de vida do usuário desligado
- Desligamento ⇒ `status=inactive` **imediato** (perde acesso ao sistema na hora).
- Dados pessoais (nome, foto, telefone, e-mail, `cpf_hash`, data de nascimento) são **anonimizados** após o prazo de retenção configurável por tenant (default proposto: 24 meses), substituídos por rótulo pseudonimizado (ex.: "Colaborador #<id_pseudonimo>").
- **Exceção — registros de ciência:** `AnnouncementAck` e o vínculo mínimo necessário para provar quem confirmou o quê permanecem, ligados ao identificador pseudonimizado, pelo prazo prescricional trabalhista (proposta: 5 anos + margem — confirmar com jurídico antes da fase comercial, DP-06). A prova de ciência não é apagada junto com o resto: essa é a finalidade legal que justifica retê-la.

## Alternativas consideradas
- **Login por matrícula** — mais limpo em LGPD (CPF sairia do fluxo), mas contraria a realidade de uso do piloto (pessoas não decoram matrícula); rejeitada por Pedro com base no chão de loja.
- **Guardar últimos N dígitos do CPF em índice separado** — permitiria "CPF parcial", mas cria um dado pessoal parcial em claro sem ganho real; rejeitada.
- **Soft-delete puro do usuário (sem anonimizar)** — mantém dado pessoal indefinidamente sem base legal após retenção; rejeitada por conflitar com minimização/eliminação da LGPD.

## Consequências
+ Contradição de auth do kickoff resolvida; INC-003 desbloqueado com desenho claro.
+ CPF nunca em claro; busca de login viável via hash determinístico + pepper.
+ Retenção diferenciada preserva valor probatório (a razão de o produto existir) sem reter tudo indefinidamente.
− Hash determinístico é teoricamente mais exposto a ataque de dicionário que hash salgado por registro — mitigado pelo pepper secreto e pelo fato de CPF não ser segredo de autenticação (a senha é). Aceito.
− Anonimização exige job/rotina e teste (entra no INC-013, hardening); `cpf_hash` determinístico também precisa de rotação de pepper documentada como procedimento de emergência.

## Gatilho de revisão
- Integração com folha/ERP exigir CPF recuperável em claro → campo separado cifrado (AES-GCM), decisão nova.
- Jurídico (DP-06) devolver prazos diferentes dos defaults → atualizar retenção.