---
title: "Cor, fonte e logo em 30 segundos"
description: "Toda customização visual do scaffold acontece em um único lugar — /admin/config. Aqui está o que cada campo faz e como ele afeta o resultado."
pubDate: 2026-05-24
category: "Configuração"
author: "Scaffold MSIA"
order: 2
---

A maior parte das pessoas perde tempo demais nessa etapa porque acha que precisa mexer em código. Não precisa. Todas as decisões visuais do scaffold passam por **/admin/config** — sem exceção.

Este post explica cada campo da seção *Tema* do admin, o que ele controla, e quais combinações ficam bem.

## Os 4 campos do tema

### Cor primária

Controla: links, accent de hover no header, indicador de active state no menu, cor de citação ::selection.

**Não controla:** as cores das categorias dos posts. Aquelas são fixas e curadas (terracota, azul-tinta, oliva, ocre, vinho). Você pode trocá-las editando `src/lib/categoryColors.ts`, mas é a única customização visual que pede código.

> Boa cor primária pra dark theme: algo entre OKLCH 60-75% lightness, chroma médio (0.10-0.18). Cores muito escuras somem no background.

### Cor escura

Controla: cor do fundo do site. Default é `#0e1016` — um azul-tinta profundo. Pode trocar pra qualquer cor escura (chocolate, vinho escuro, verde-musgo profundo).

Se quiser um scaffold com sensação completamente diferente, trocar só esse campo já muda 60% da identidade. Experimente `#1a1814` (chocolate) ou `#0e1812` (verde-musgo) e veja.

### Fonte display

Default: **Switzer**. Aplicada em headings (h1-h4), logo, títulos de bloco.

**Quando trocar:** se você quer um tom completamente diferente. Sugestões fora da lista saturada:

- **Boska** (Fontshare, grátis) — serif geométrica com personalidade. Bom pra editorial.
- **Migra** (Pangram, grátis) — display moderna, mais character que Switzer.
- **Cabinet Grotesk** (Fontshare, grátis) — sans alternativa, mais industrial.

Evite Fraunces, Outfit, Inter Display, Space Grotesk — todas saturadas pelo mercado.

### Fonte body

Default: **Switzer** também (variable cobre display + body via weight). Pode usar a mesma fonte que display, ou diferente.

Combinações que funcionam:
- Boska (display) + Switzer (body) — editorial moderno
- Switzer (display) + Switzer (body) — minimalista contemporâneo (default)
- Migra (display) + Inter Tight (body) — display character + body clean

## Onde os campos ficam

Tudo está em `src/data/siteConfig.json`, mas você não precisa abrir o arquivo. O admin escreve nele pra você.

```json
{
  "theme": {
    "primary": "#1c64c8",
    "dark": "#0e1016",
    "fontDisplay": "Switzer",
    "fontBody": "Switzer"
  }
}
```

Depois de salvar no admin, em produção a mudança aparece em segundos. Em dev local, o Astro recarrega automaticamente.

## O erro mais comum

Tentar fazer o scaffold parecer "Wordpress padrão" trocando pra fontes serif clássicas e cores azul/cinza institucionais.

Não. O scaffold foi desenhado pra ser ousado. Se você o tornar "seguro", ele perde 100% da personalidade que era pra ser o motivo de você ter escolhido ele. Confie nas escolhas default por pelo menos uma semana antes de tentar mudar tudo.
