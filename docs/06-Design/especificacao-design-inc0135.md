# Especificação de design — INC-013.5 (extraída do protótipo aprovado)

O protótipo original ("Conecta - Protótipo (offline).html") tinha 2,8 MB porque o
export do Claude Design embutia ilustrações e runtime. Este documento extrai o que
importa para a implementação: a PALETA EXATA (tirada do CSS do próprio protótipo).
*(Os arquivos de referência HTML e os prints do protótipo foram removidos do
repositório na preparação para publicação (INC-027) — continham marca e dados de
terceiro. A paleta abaixo é a fonte de verdade que sobrevive independente deles.)*

## PALETA EXATA (hex tirados do protótipo, por papel)

### Tinta / texto
- `#20261F` — tinta principal (títulos, texto forte)
- `#4A5248` — texto secundário forte
- `#6B7469` — texto secundário (meta, labels)
- `#8A9187` — texto terciário / placeholder

### Verde (BASE — cor dominante do sistema)
- `#2F7A5F` — primary (navegação ativa, marca, elementos de sistema)
- `#275F4C` — verde-profundo (header/faixa de identidade, card PNG denso)
- `#E7EFE9` — verde-tint (fundo de estado ativo, anel de foco)
- `#D5E2D9` — verde-tint 2
- `#4A5248` — verde-acinzentado

### Laranja (AÇÃO — usar com parcimônia, só ação real)
- `#D96E30` — action (botões primários, "Ler e confirmar", "Declaro ciência")
- `#B3541E` — action-hover/pressed (escuro)
- `#C05E24` — action variante escura
- `#F0D8C8` — action-tint claro
- `#FBEDE3` — action-tint muito claro (fundo sutil de destaque de ação)

### Neutros / superfícies / bordas
- `#F1F2ED` — fundo da página (bg)
- `#F7F8F3` / `#F3F4EF` / `#EEF0E9` / `#E9EBE4` — superfícies neutras
- `#FFFFFF` — surface (cards)
- `#E3E6DE` — borda padrão
- `#CBD2C8` — borda 2

## Proporção de uso (validação do princípio)
No protótipo: tinta 59×, verde #2F7A5F 45×, borda 36×, cinzas ~85× somados,
laranja #D96E30 17×. Laranja é minoria — correto. Verde domina, laranja pontua.

## CORREÇÃO a aplicar (decisão de Pedro): laranja reapertado
Onde o protótipo usou laranja em NÃO-ação, trocar por verde/neutro:
- Badge "VAGA INTERNA" (categoria) → neutro/verde, NÃO laranja.
- Números de estatística que são só dado (colaboradores ativos, comunicados
  publicados) → tinta/neutro, NÃO laranja.
- Manter laranja em: botões de ação, "Ler e confirmar"/"Confirmar leitura"/
  "Declaro ciência", "Cobrar pendentes", e indicadores de pendência/urgência
  que exigem o usuário (ciências pendentes; prazo de vaga é defensável).

## Referência das 11 telas aprovadas (nos prints)
ADMIN (desktop): Início (banner + 4 cards resumo + últimos eventos/auditoria),
Comunicados (4 cards resumo + busca + chips de status + lista 3 estados),
Posts (grid de cards), Vagas (cards + botões Nova vaga/Exportar), Colaboradores
(tabela nome/matrícula/filial/papel/status/editar), Filiais (tabela + remover),
Pendências (chips de filial + cards com barra de progresso + Cobrar/Ver/Exportar).

COLABORADOR (mobile 360px): Início (saudação + banner + card de pendência com
botão laranja "Ler e confirmar" + aniversariante + feed + vagas + bottom nav),
Comunicados (busca + chips + lista 3 estados: Novo/Confirmar leitura/Lido),
Vagas (cards com badge + prazo + chevron), Perfil (avatar + Trocar foto +
Minhas confirmações + Sair da conta + rodapé LGPD).

## Componentes visuais observados
- Cards: cantos ~16px, sombra suave, fundo branco sobre bg neutro.
- Chips/filtros: pílula, ativo = verde sólido (#2F7A5F), inativo = branco+borda.
- Botão primário de ação: laranja #D96E30, texto branco, cantos arredondados.
- Botão de sistema (Novo comunicado, Nova vaga): verde #2F7A5F.
- Badge de status: Novo/Publicado = verde ponto; Agendado = laranja-claro;
  Rascunho = cinza; Lido = neutro com check.
- Header admin: marca esquerda (logo "C" + Conecta/Rede Vale Verde), nav central
  com ativo em verde-tint, badge de pendências, identidade direita (PC / nome /
  Admin·Filial).
- Bottom nav (mobile): 4 itens com ícone+label, ativo em verde, badge laranja
  em Comunicados; fixa; ocultar em ≥640px.
