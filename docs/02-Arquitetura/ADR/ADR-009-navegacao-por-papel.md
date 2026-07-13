# ADR-009 — Arquitetura de navegação por papel

**Status:** Aceito
**Aceito em:** 2026-07-13 (Pedro Catrinck)
**Data:** 2026-07-13
**Decisores:** Pedro Catrinck
**Relaciona-se com:** ADR-002 (PWA mobile-first), papéis definidos no schema (`UserRole`) e aplicados via guards `requireAdmin`/`requireAdminOrManager`, design-system (§4 bottom nav), resolve o DP-10.

## Contexto
Até o INC-008, cada tela nasceu acessível só por link direto ou URL digitada à mão — não existe navegação global. O painel admin, por exemplo, só aparece digitando `/admin`. Isso foi adiado de propósito (DP-10): definir os itens de navegação exigia saber quais telas existiriam, o que só agora está claro (comunicados, feed, pendências, posts, perfil, admin). O produto tem dois perfis de uso com necessidades opostas: o colaborador (maioria, celular modesto, pressa, precisa de pouquíssimas opções grandes) e o admin/RH (desktop majoritariamente, precisa de muitas opções organizadas). Misturar os dois num menu só foi exatamente o erro da portal legado (hambúrguer de 18 itens misturando "Foi show" com "Sair").

## Decisão
Dois sistemas de navegação distintos, selecionados por papel.

### Colaborador (employee) — bottom navigation mobile-first
- Itens: **Início** (home/feed) · **Comunicados** (com badge de pendência) · **Perfil**.
- **Vagas** entra como 4º item quando o INC-011 for implementado.
- Máximo de 5 itens (regra de bottom nav: 3–5, alvos ≥48px). Início/Comunicados/Perfil = 3 agora.
- O item **Comunicados exibe badge** (contador) quando há comunicado pendente de ciência — puxa o colaborador para a ação mais importante do produto sem ele procurar. É o oposto do banner dispensável da portal legado.
- Componente `BottomNav` já existe (INC-003.5) — este INC popula os itens reais.

### Admin — bottom nav + menu administrativo no header
- O admin **também** vê o bottom nav de colaborador (ele é uma pessoa que quer ver o feed e os comunicados como qualquer um, inclusive para conferir o que publica).
- **Adicionalmente**, um menu administrativo no **header (topo)**, visível só para admin: Comunicados · Posts · Colaboradores · Filiais · Pendências · Auditoria.
- Por que header e não bottom nav: o RH trabalha majoritariamente em desktop (cadastro, redação de comunicado, export CSV — tarefas de escritório). Bottom nav é padrão mobile; num desktop fica deslocado. Header é o padrão natural de app administrativo e funciona nos dois tamanhos.

### Manager — bottom nav + acesso a Pendências
- Bottom nav de colaborador + acesso ao **Painel de pendências** (única tela administrativa que o manager usa, INC-006).
- No piloto (Vale Verde) o papel manager não será usado (gestão centralizada no RH), mas a navegação já respeita o papel para clientes futuros que deleguem gestão por filial.

## Alternativas consideradas
- **Menu único (hambúrguer) para todos** — simples de implementar, mas reproduz o erro da portal legado (mistura tudo, alvos ruins, sem hierarquia por papel); rejeitada.
- **Admin só no bottom nav (item "Admin")** — funcionaria, mas espreme 6 telas administrativas num item só e ignora que o RH usa desktop; rejeitada em favor do header.
- **Sem bottom nav para admin** — obrigaria o RH a trocar de conta para ver o produto como colaborador; rejeitada (ele precisa conferir o que publica).

## Consequências
+ Colaborador tem navegação simples, mobile-first, com a ação crítica (comunicados pendentes) em destaque.
+ Admin tem acesso completo sem depender de URL decorada.
+ Navegação respeita papel de forma estrutural (o que o usuário vê depende do role da sessão).
− Duas superfícies de navegação para manter (bottom nav + header admin). Aceito — é a separação certa.
− O badge de pendência no bottom nav exige uma contagem por request nas rotas do colaborador (reusar `countPendingAcksForUser` do INC-005 — não recalcular).

## Gatilho de revisão
Número de itens do bottom nav passar de 5 (ex.: se muitas features novas de colaborador surgirem) → repensar agrupamento. Cliente com necessidade de navegação administrativa muito maior → considerar sidebar.
