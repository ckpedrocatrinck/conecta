# Guia de uso — tokens e componentes-base (INC-003.5, elevado no INC-013.5)

> Como este documento se relaciona com o resto: `docs/06-Design/design-system.md` é a fonte de verdade visual (decisões) e, desde o INC-013.5, `docs/06-Design/redesenho-referencia.html` ("Conecta Elevacao") é a referência dos valores exatos. Este guia é a tradução para código — para quem (Claude Code incluído) vai montar uma tela a partir dos INCs.

## Tokens

Definidos em `src/app/globals.css` (`:root` + `.dark`), expostos como classes Tailwind via `@theme inline`. Valores do redesenho "Conecta Elevacao" (seção 1a do HTML de referência).

| Token CSS | Valor (claro) | Classe Tailwind | Uso |
|---|---|---|---|
| `--primary` | `#2F7A5F` | `bg-primary` etc. | marca, navegação ativa, botão comum |
| `--primary-hover` | `#275F4C` | `hover:bg-primary-hover` | hover/pressed do primário |
| `--primary-deep` | `#275F4C` | `bg-primary-deep` | superfície de marca: faixa do header admin, card PNG, texto de selo |
| `--primary-subtle` | `#E7EFE9` | `bg-primary-subtle` | selo/tint, anel de foco, fundo calmo |
| `--action` | `#D96E30` | `bg-action` | **só ações do usuário** — regra de ouro abaixo |
| `--action-hover` | `#C05E24` | `hover:bg-action-hover` | pressed da ação |
| `--action-deep` | `#B3541E` | `bg-action-deep` / `text-action-deep` | título de pendência; único laranja AA com texto branco pequeno (badges sólidos) |
| `--action-subtle` | `#FBEDE3` | `bg-action-subtle` | tile de ícone de pendência |
| `--action-border` | `#F0D8C8` | `border-action-border` | borda de card que carrega pendência |
| `--background` | `#F1F2ED` | `bg-background` | fundo de tela |
| `--card` | `#FFFFFF` | `bg-card` | superfície elevada |
| `--muted` / `--secondary` | `#F7F8F3` | `bg-muted` | superfície recuada (card "lido") |
| `--foreground` | `#20261F` | `text-foreground` | texto principal (ink) |
| `--foreground-soft` | `#4A5248` | `text-foreground-soft` | texto intermediário (chip inativo, corpo de banner) |
| `--muted-foreground` | `#6B7469` | `text-muted-foreground` | texto secundário |
| `--subtle-foreground` | `#8A9187` | `text-subtle-foreground` | terciário / meta / placeholder |
| `--border` / `--input` | `#E3E6DE` | `border-border` | divisórias, borda de campo |
| `--border-strong` | `#CBD2C8` | `border-border-strong` | borda de botão outline, vazio tracejado |
| `--destructive` | `#B3432B` | `text-destructive` | erros, ações irreversíveis (outline) |
| `--destructive-border` | `#E5C8BD` | `border-destructive-border` | borda do botão destrutivo-outline |
| `--radius` | **12px** | `rounded-lg` | campos e botões |
| `--radius-card` | **16px** | `rounded-[var(--radius-card)]` (via `Card`) | cards |
| chips | pílula | `rounded-full` | filtros, badges |
| `--shadow-card` | 2 camadas `rgb(32 38 31 / .05)` | `shadow-[var(--shadow-card)]` (via `Card`) | elevação discreta |
| `--font-figtree` | — | `font-sans` (default) | única família |

### Escala tipográfica (utilitários gerados)

| Utilitário | Tamanho/peso | Uso |
|---|---|---|
| `text-display` | 26px / 800 / -0.01em | título de tela |
| `text-card-title` | 17px / 700 | título de card (default do `CardTitle`) |
| `text-body` | 15px / lh 1.5 | corpo (leitura de comunicado) |
| `text-meta` | 13px / 500 | data · filial · categoria |
| `text-label` | 12px / 700 / +0.02em | selos e estados (default do `Badge`) |

Nunca usar `zinc-*`, `gray-*` ou hex literal nas telas — sempre os tokens acima. (Exceção legítima: `src/lib/cards/brand-tokens.ts` e `src/lib/cards/avatar.ts`, espelhos manuais para o satori.)

## Regra de ouro: `--action` (laranja) só para ações do usuário

`--action` **nunca** é decoração. Duas camadas garantem isso na prática:

1. O token só existe com esse nome — não é reaproveitado por nenhum componente shadcn padrão (focus ring, `--accent` etc. apontam para `--primary`).
2. `Button` tem uma variante `action` **separada** de `default`. `default` é verde e é o botão comum. Só use `variant="action"` para os casos que o design-system nomeia como ação central do produto: confirmar leitura/ciência, candidatar-se a uma vaga, aceitar consentimento obrigatório (LGPD). Login, salvar perfil, trocar senha — tudo `default` (verde).

Na dúvida: "se o usuário não clicar aqui, algo trava ou fica pendente no núcleo do produto?" Só "sim" justifica laranja. Badge de contagem de pendência também é laranja (é pendência que exige o usuário), via `Badge variant="count"`.

## Componentes-base (`src/components/ui/`)

- **`Button`** (`button.tsx`) — variantes `default` (verde sólido) | `outline` (borda `--border-strong`) | `secondary` | `ghost` (texto verde, hover tint) | `destructive` (**outline** vermelho, redesenho 1b) | `action` (laranja) | `link`; tamanhos `xs | sm | default | lg | touch | xl | icon*`. `size="xl"` (48px, texto 20px negrito) para o CTA principal de tela de colaborador — é o tamanho que garante AA no laranja; `touch` dá 48px sem a carga visual.
- **`Input`** (`input.tsx`) — borda 1.5px; foco = borda `--primary` + anel `--primary-subtle` (**nunca laranja**); `size`: `default` (32px, admin) ou `lg` (48px, colaborador).
- **`Badge`** (novo, `badge.tsx`) — pílula `text-label`; variantes `new` (tint verde, usar com `dot`), `pending` (sólido `--action-deep`, único badge laranja), `quiet` (outline neutro, lido/confirmado), `label` (selo de seção/tipo, uppercase), `count` (bolinha de contagem laranja). Estados de comunicado: sempre cor **e** rótulo.
- **`FilterChip`** (novo, `filter-chip.tsx`) — pílula de filtro 40px com área de toque expandida a 48px via pseudo-elemento; exporta `filterChipVariants` (cva) para uso em `<Link>` de filtro por searchParams.
- **`Avatar`** (novo, `avatar.tsx`) — foto `cover`+centro (nunca achatar) ou iniciais com cor determinística (`src/lib/cards/avatar.ts`, fonte única compartilhada com o satori); tamanhos `sm|md|lg|xl`; prop `confirmed` para o selo verde de ciência (redesenho 1d). `photoUrl` já chega filtrado por consentimento — o componente nunca decide isso. (`src/components/cards/avatar-fallback.tsx` continua para os templates de card, tamanho em px.)
- **`Card` / CardHeader / CardTitle / ...** (`card.tsx`) — r16, sombra dupla; `CardTitle` usa `text-card-title`.
- **`PendingBanner`** (`pending-banner.tsx`) — card branco com borda `--action-border`, tile de ícone laranja-claro, título `--action-deep`, `action` renderizada em largura total; **sem prop de fechar** (persiste enquanto houver pendência).
- **`EmptyState`** (`empty-state.tsx`) — card tracejado com ícone em círculo verde-claro; textos sempre via prop.
- **`Loading`** (`loading.tsx`) — spinner + pt-BR, respeita `prefers-reduced-motion`.
- **`ErrorState`** (`error-state.tsx`) — ícone em círculo `--destructive/10`, retry em `default` (não laranja).
- **`BottomNav`** (`bottom-nav.tsx`) — itens reais em `src/components/nav/app-bottom-nav.tsx`.
- **`Checkbox`**, **`Label`**, **`ConfirmDialog`**, **`SubmitButton`** — alinhados aos tokens elevados.

## Ícones

`lucide-react` é a única biblioteca de ícones do projeto. Importar sempre `import { NomeDoIcone } from "lucide-react"`.

## Fontes

Figtree via `next/font/google`, pesos 400/500/600/700/800, carregada em `src/app/layout.tsx` como `--font-figtree`. Uma família só. (O gerador de card PNG embute a Figtree à parte — ver INC-013.5, Bloco 5.)

## Contraste — nota importante sobre laranja

Texto branco sobre `--action` (`#D96E30`) dá ≈3.37:1 — passa WCAG AA só para "texto grande" (≥18.66px em negrito). Por isso:

- CTA laranja usa `size="xl"` (20px negrito).
- Badge/texto pequeno laranja usa `--action-deep` (`#B3541E`): branco sobre ele dá ≈4.99:1 (AA ✓), e ele sobre branco dá ≈5.0:1 (AA ✓). Decisão do INC-013.5 (Pedro): manter AA prevalece sobre o hex literal do redesenho nesses casos.

## Pendência registrada: dark mode fino

O modo escuro mantém os neutros da seção 8 do design-system; `--primary`/`--action` seguem sem ajuste de luminância (não documentado — evitar inventar decisão visual). Dark mode segue fora do escopo do INC-013.5.
