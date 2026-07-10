# Guia de uso — tokens e componentes-base (INC-003.5)

> Como este documento se relaciona com o resto: `docs/06-Design/design-system.md` é a fonte de verdade visual (decisões). Este guia é a tradução para código — para quem (Claude Code incluído) vai montar uma tela nova a partir dos INCs 004+.

## Tokens

Definidos em `src/app/globals.css` (`:root` + `.dark`), expostos como classes Tailwind via `@theme inline`. Nomes idênticos aos da tabela da seção 2 do design-system.md.

| Token CSS | Classe Tailwind | Uso |
|---|---|---|
| `--primary` | `bg-primary` / `text-primary` / `border-primary` | marca, navegação ativa, botão comum |
| `--primary-hover` | `hover:bg-primary-hover` | hover/pressed do primário |
| `--primary-subtle` | `bg-primary-subtle` | realce calmo, fundo de estado vazio |
| `--action` | `bg-action` / `text-action` | **só ações do usuário** — ver regra de ouro abaixo |
| `--action-hover` | `hover:bg-action-hover` | hover/pressed da ação |
| `--action-subtle` | `bg-action-subtle` | fundo do banner de pendência |
| `--background` | `bg-background` | fundo de tela |
| `--card` | `bg-card` | superfície elevada (cards) |
| `--muted` / `--muted-foreground` | `bg-muted` / `text-muted-foreground` | fundo alternativo / texto secundário |
| `--subtle-foreground` | `text-subtle-foreground` | texto terciário / meta |
| `--border` | `border-border` | divisórias |
| `--foreground` | `text-foreground` | texto principal |
| `--success` / `--warning` / `--info` / `--destructive` | `text-success` etc. | estados semânticos |
| `--radius-card` (12px) | usado no `Card` | raio de cards |
| `--radius` (8px) | usado por `Button`/`Input` via `--radius-md`/`--radius-lg` | raio de controles |
| `--shadow-card` | usado no `Card` | elevação, um nível só |
| `--font-figtree` | `font-sans` (default do app) | única família tipográfica |

Nunca usar `zinc-*`, `gray-*` ou hex literal nas telas — sempre os tokens acima.

## Regra de ouro: `--action` (laranja) só para ações do usuário

`--action` **nunca** é decoração. Duas camadas garantem isso na prática:

1. O token só existe com esse nome — não é reaproveitado por nenhum componente shadcn padrão (focus ring, `--accent` genérico etc. apontam para `--primary`).
2. `Button` tem uma variante `action` **separada** de `default`. `default` é verde e é o botão comum. Só use `variant="action"` para os casos que o design-system nomeia como ação central do produto: confirmar leitura/ciência de um comunicado, candidatar-se a uma vaga, aceitar um aviso de consentimento obrigatório (LGPD). Edição de perfil, salvar preferências, login, trocar senha — tudo isso é `default` (verde), mesmo sendo um "botão de submeter formulário".

Se você (ou o Claude Code de um INC futuro) estiver na dúvida se um botão é `action` ou `default`, pergunte: "se o usuário não clicar aqui, algo trava ou fica pendente no núcleo do produto?" Só "sim" justifica laranja.

## Componentes-base (`src/components/ui/`)

- **`Button`** (`button.tsx`) — variantes `default | outline | secondary | ghost | destructive | action | link`; tamanhos `xs | sm | default | lg | xl | icon*`. Use `size="xl"` (48px, texto 20px negrito) para os CTAs principais de tela de colaborador em mobile — é o tamanho que garante contraste AA no laranja (ver nota abaixo) e alvo de toque ≥48px.
- **`Input`** (`input.tsx`) — prop `size`: `default` (32px, usado no admin/desktop) ou `lg` (48px, usado nas telas de colaborador).
- **`Checkbox`** (`checkbox.tsx`) — primitiva Base UI, estado marcado em `--primary`.
- **`Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter`** (`card.tsx`) — envoltório padrão para qualquer bloco de conteúdo (perfil, futuramente comunicado/feed/vaga).
- **`PendingBanner`** (`pending-banner.tsx`) — fundo `--action-subtle`, **sem prop de fechar** (estruturalmente impossível fechar sem editar o componente — é a regra "banner de pendência persiste" do design-system). Ainda não usado em nenhuma tela; é para os INCs de comunicados.
- **`EmptyState`** (`empty-state.tsx`) — ícone + título + descrição, textos sempre via prop (nunca hardcode em inglês).
- **`Loading`** (`loading.tsx`) — spinner + mensagem pt-BR, respeita `prefers-reduced-motion`.
- **`ErrorState`** (`error-state.tsx`) — mensagem pt-BR + botão de retry opcional em `default` (retry não é ação-core, não é laranja).
- **`BottomNav`** (`bottom-nav.tsx`) — componente genérico (`items`, `activeHref`), pronto visualmente (fundo `--card`, ativo `--primary`) mas **sem itens definidos e sem integração em nenhuma tela ainda** — os 4–5 itens reais e onde ele aparece ficam para o INC de navegação, conforme o design-system pede explicitamente para não copiar a portal legado sem revisar.

## Ícones

`lucide-react` é a única biblioteca de ícones do projeto (já configurada em `components.json`). Importar sempre `import { NomeDoIcone } from "lucide-react"`.

## Fontes

Figtree via `next/font/google`, pesos 400/500/600/700/800, carregada em `src/app/layout.tsx` como `--font-figtree`. Uma família só — não introduzir outra fonte nem monospace sem necessidade real.

## Contraste — nota importante sobre `--action`

Texto branco sobre `--action` (`#D96E30`) dá razão de contraste ≈3.37:1 — passa WCAG AA só para "texto grande" (≥18.66px em negrito), **não** para texto normal. Por isso `size="xl"` do `Button` usa 20px negrito. Não use texto branco pequeno sobre fundo `--action` (ex.: badges pequenos) sem validar contraste de novo — considere `--action-hover` (mais escuro) ou texto em `--foreground` sobre `--action-subtle` para esses casos.

## Pendência registrada: dark mode fino

O modo escuro tem os tokens neutros (fundo/superfície/texto) implementados com os hex exatos do design-system.md, seção 8. `--primary` e `--action` no dark mode reaproveitam o mesmo hex do modo claro — o design-system menciona "luminância ajustada para AA" para esses dois no escuro, mas não dá o hex exato, então esse ajuste fino não foi feito aqui (evitar inventar decisão visual não documentada). Fica pendente para uma fase futura, quando o dark mode for de fato priorizado.
