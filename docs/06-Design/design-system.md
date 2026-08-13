# Design System — Conecta

> **Status:** ✅ Preenchido (direção **Balcão / 1b** escolhida por Pedro, 2026-07-10, a partir das três direções geradas no Claude Design).
> Fonte de verdade visual do produto. O Claude Code lê daqui (e dos tokens no código) para implementar toda tela. O INC-003.5 traduz este documento em tokens (variáveis CSS / Tailwind / tema shadcn) e componentes-base.

---

## 0. Princípios (o "porquê" antes do "quê")

O design resolve a tese do produto: o portal legado é abandonado por ser feio, pesado e confuso. Cada decisão visual serve a:

1. **Mobile-first de verdade** — desenhado para 360px e polegar. Alvos de toque ≥ 48px. Nada essencial em hover.
2. **Leve em rede ruim** — dados móveis limitados, aparelhos modestos. Sem peso decorativo inútil, feedback de carregamento honesto.
3. **Claro em 30 segundos** — abrir e entender "o que é novo / o que preciso fazer" quase instantaneamente. Hierarquia forte.
4. **Digno, não infantil** — profissional sem ser sisudo nem gamificado-bobo. É ambiente de trabalho (normas trabalhistas, hora extra).
5. **Anti-padrão do portal legado explícito** — NÃO repetir: texto como imagem; capitalização quebrada ("SAúDE"); telas vazias sem estado; navegação redundante ("Lazer > Lazer"); erro em inglês; visual pesado e datado.

## 0.1 Conceito da direção escolhida — "Balcão"

**Direto e funcional.** A ideia central que rege todo o resto: **o laranja é a cor da AÇÃO, e só dela.** Verde e neutros formam a base calma do app; o laranja aparece exclusivamente onde o usuário precisa fazer algo (confirmar leitura, candidatar-se, botão primário). Isso treina o olho do colaborador — laranja = "isto exige você". Serve diretamente ao núcleo do produto (confirmação de ciência de comunicados).

Regra de ouro para o Claude Code: **nunca usar o laranja (`--action`) para decoração.** Se não é uma ação do usuário, não é laranja.

## 1. Identidade de marca

- **Nome exibido:** "Conecta" (placeholder — DP-02 em aberto).
- **Personalidade em 3 palavras:** direto, confiável, humano-sem-exagero.
- **Multi-tenant:** a identidade do Conecta (abaixo) é fixa. Cada tenant injeta apenas logo + 1 cor de destaque em pontos configuráveis (cards gerados, header) — sem quebrar a linguagem base.

## 2. Paleta de cores (direção Balcão)

Modo claro é o padrão. Modo escuro na seção 8.

### Marca / ação
| Papel | Hex | Token | Uso |
|---|---|---|---|
| Verde primário (marca) | `#2F7A5F` | `--primary` | identidade, elementos de marca, navegação ativa |
| Verde primário escuro | `#22604A` | `--primary-hover` | hover/pressed do primário |
| Verde muito claro | `#E7F1EC` | `--primary-subtle` | realce calmo, chips de status "ok" |
| **Laranja de AÇÃO** | `#D96E30` | `--action` | **exclusivo de ações**: botão primário, "Confirmar leitura", candidatar-se |
| Laranja ação (hover) | `#B25419` | `--action-hover` | hover/pressed da ação |
| Laranja ação (claro) | `#FCF3EC` | `--action-subtle` | fundo de banner de pendência |

### Neutros (base do app)
| Papel | Hex | Token |
|---|---|---|
| Fundo (superfície) | `#F4F5F3` | `--background` |
| Card / superfície elevada | `#FFFFFF` | `--card` |
| Fundo alternativo | `#EDEFEC` | `--muted` |
| Borda / divisória | `#E3E6E2` | `--border` |
| Texto principal | `#1F2422` | `--foreground` |
| Texto secundário | `#6B736E` | `--muted-foreground` |
| Texto terciário / meta | `#828A85` | `--subtle-foreground` |

### Semânticos (estados)
| Papel | Hex | Token | Uso |
|---|---|---|---|
| Sucesso | `#2F7A5F` | `--success` | comunicado **Lido/Confirmado** (reusa o verde) |
| Pendência / atenção | `#D96E30` | `--warning` | **Confirmar leitura** (é o laranja de ação — coerente) |
| Novo / informativo | `#2F7A5F` sobre `--primary-subtle` | `--info` | badge "Novo (não lido)" |
| Erro / destrutivo | `#C0392B` | `--destructive` | falhas, exclusões |

Contraste: toda combinação texto/fundo passa AA. Validar qualquer par novo.

### Os três estados de comunicado (crítico — inequívocos)
- **Novo (não lido):** marcador em `--primary` + título em peso forte. Badge visível.
- **Confirmar leitura (pendente):** faixa/etiqueta em `--action` (laranja). Único item da lista que "puxa" com cor de ação.
- **Lido/Confirmado:** neutro, título peso normal, check em `--success`. Recua visualmente.

## 3. Tipografia

Direção Balcão usa **Figtree** (uma família, vários pesos — leve, ótima em tela pequena).

| Uso | Fonte | Peso | Tamanho base (mobile) |
|---|---|---|---|
| Títulos de tela/seção | Figtree | 800 | 20–24px |
| Título de card | Figtree | 700 | 16px |
| Corpo | Figtree | 400–500 | 16px (nunca < 16 no mobile) |
| Rótulos / meta | Figtree | 600 | 12–13px |

Carregar via `next/font` (self-host, sem FOUT pesado). Uma família só.

## 4. Componentes-chave (aparência)

- **Bottom navigation:** fundo `--card`, item ativo `--primary`, inativo `--muted-foreground`. Ícones lucide, rótulos curtos. Definir os 4–5 itens no INC de navegação (não copiar os 4 do portal legado sem revisar).
- **Card de comunicado (lista):** os três estados acima. Só o pendente é laranja.
- **Tela de leitura de comunicado:** texto real legível; botão "Declaro ciência" em `--action`, largura total, alvo grande — ação mais importante do app.
- **Banner de pendência:** fundo `--action-subtle`, texto `--foreground`, **sem botão de fechar**. Persiste enquanto houver pendência.
- **Card de feed** (reconhecimento/tempo de casa/aniversário): base calma (neutros + toques de verde), foto em destaque. Base dos templates gerados (ADR-004/INC-009). Energia vem do conteúdo, não de cor de ação.
- **Card de vaga + candidatura:** botão candidatar-se em `--action` (1 toque).
- **Estados vazios:** OBRIGATÓRIOS em toda tela sem conteúdo. Formas geométricas da marca + texto amigável explicando o que aparecerá. Nunca tela branca muda.
- **Carregamento e erro:** pt-BR, humanos. Nunca "Notifications are denied by the user".
- **Formulários:** inputs com borda `--border`, foco `--primary`, validação em pt-BR, erro `--destructive`.

## 5. Iconografia e imagem

- **Ícones:** lucide-react (já na stack). Uma biblioteca só.
- **Formas geométricas da marca:** textura de estados vazios, cabeçalhos de card de feed, fundos de card gerado — leve e escalável.
- **Fotos:** corte consistente; fallback de avatar (inicial + cor derivada) sem foto ou com consentimento de foto desligado.

## 6. Layout e espaçamento

- Grid mobile: margem lateral 16px, gap entre cards 10–12px.
- Escala de espaçamento: padrão Tailwind (base 4px).
- **Raio de borda:** `--radius` 12px (cards), 8px (inputs/botões) — arredondado moderado.
- **Elevação:** sombra sutil nos cards, um nível só no MVP.
- **Densidade:** levemente arejada (~35–40 da escala do briefing) — cards respiram, vários numa olhada.

## 7. Acessibilidade (mínimos)

- Contraste AA em texto e ações.
- Alvos de toque ≥ 48px.
- Foco visível (teclado no admin desktop).
- `prefers-reduced-motion` respeitado.
- Estado nunca só por cor: "pendente" tem cor (laranja) **e** rótulo ("Confirmar leitura").

## 8. Modo escuro (definido; implementação opcional no MVP)

Tokens escuros de referência (do HTML): fundo `#17191C` / superfície `#1F2422`; texto `#E9EDEA` principal, `#9AA19C` secundário; primário e ação mantêm matiz com luminância ajustada para AA.

Prioridade: modo claro no MVP. Escuro é bônus — se sair barato no INC-003.5, incluir; senão, fase posterior. Não bloquear por isso.

---

## Uso pelo Claude Code

O INC-003.5 traduz seções 2, 3, 6, 8 em **tokens** (CSS vars / Tailwind / tema shadcn) e seções 4, 5 em **componentes-base**. Regra permanente de frontend: **`--action` (laranja) só para ações do usuário**; base do app é verde + neutros.
