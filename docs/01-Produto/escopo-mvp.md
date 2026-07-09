# Escopo do MVP

Referências: tese em `visao-e-tese.md`; o que ficou de fora em `fora-do-escopo-fase2.md`; decomposição executável em `04-Roadmap/`.

## Módulo A — Núcleo: Comunicados com trilha de auditoria

**A1. Criação (painel admin)**
- Comunicado como entidade: número sequencial automático (`CI 25/2026`), título, corpo em rich text (não imagem), categoria, anexos opcionais, público-alvo (todos | filiais específicas), criticidade (informativo | requer confirmação), agendamento de publicação.
- Preview do card visual gerado por template antes de publicar.

**A2. Consumo (app colaborador)**
- Lista com busca por texto e filtro por categoria; distinção clara lido/não lido/pendente de confirmação.
- Leitura em texto nativo responsivo (nunca imagem de texto).
- Botão "Declaro ciência" com registro de: usuário, timestamp (UTC + exibição America/Sao_Paulo), versão do comunicado, hash do conteúdo no momento da confirmação.
- Comunicado editado após publicação gera **nova versão**; confirmações apontam para a versão lida. Edição de comunicado crítico já confirmado reabre pendência (com aviso ao admin).

**A3. Auditoria (painel admin + gestor)**
- Painel de pendências: por comunicado → quem falta, filtrável por filial; por colaborador → o que falta.
- Reenvio de cobrança (push/notificação in-app) em um clique.
- Exportação CSV do log de confirmações (evidência jurídica).
- Visão do gestor de filial: pendências apenas da sua filial.

## Módulo B — Engajamento: Feed estruturado

- Tipos de post: **Reconhecimento** (Foi Show), **Tempo de Casa**, **Promoção de colaborador**, **Datas/avisos gerais**. Todos com dados estruturados (pessoas marcadas, filial, fotos) — o card visual é **gerado por template HTML/CSS** (ADR-004), não montado à mão.
- **Aniversariantes**: gerado automaticamente do cadastro; card do dia/semana; filtro por filial. Exibição de aniversário exige consentimento/opt-out do colaborador (ver LGPD).
- Reações simples (1 tipo, ex.: 👏) nos posts. Sem comentários no MVP.

## Módulo C — Vagas internas estruturadas

- Vaga como entidade: cargo, filial, turno/horário, requisitos, prazo, status (aberta/encerrada).
- Colaborador se candidata em 1 toque; pode anexar observação.
- Admin vê lista de candidatos por vaga e exporta.

## Módulo D — Fundação (transversal)

- **Multi-tenant desde o schema** (ADR-003): `tenant_id` em tudo, isolamento por row-level; piloto = tenant 1.
- **Cadastro**: tenants, filiais, colaboradores (import CSV + CRUD manual), papéis (admin | gestor | colaborador).
- **Autenticação**: login por **CPF completo + senha** (ADR-006); CPF armazenado só como hash determinístico com pepper, nunca em claro. Primeiro acesso com troca obrigatória de senha. Matrícula (`registration_code`) é identificador interno, não credencial. Sem e-mail obrigatório (colaborador operacional muitas vezes não tem corporativo).
- **PWA** (ADR-002): instalável, push via Web Push, funciona razoável em rede ruim (cache de leitura).
- **LGPD**: requisitos de `03-LGPD/lgpd-requisitos-tecnicos.md` valem para todos os módulos.
- **Perfil**: meus dados, minha foto, minhas confirmações, minhas candidaturas.

## Critério geral de pronto do MVP

O MVP está pronto quando o RH do piloto consegue, sem ajuda: publicar um comunicado crítico, atingir ≥90% de confirmação em 7 dias usando o painel de cobrança, publicar um post de reconhecimento com card gerado, e abrir uma vaga que receba candidaturas — tudo pelo celular se necessário.
