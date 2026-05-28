---
name: MSIA Scaffold · Café-da-Tarde Editorial
description: Blog editorial brasileiro sóbrio em canvas off-white warm, com 5 cores de categoria committed que transformam cada post numa porta colorida. Mesma casca Café-da-Tarde da plataforma, aplicada a conteúdo.
colors:
  bg: "oklch(97% 0.008 80)"
  surface: "oklch(99.5% 0.004 80)"
  elev: "oklch(94% 0.012 80)"
  border: "oklch(86% 0.014 80)"
  rule: "oklch(81% 0.014 80)"
  ink: "oklch(15% 0.008 80)"
  ink-muted: "oklch(40% 0.012 80)"
  ink-faint: "oklch(60% 0.014 80)"
  primary-coral-terra: "oklch(45% 0.080 35)"
  primary-soft-coral-wash: "oklch(88% 0.025 35)"
  cat-terracota: "oklch(60% 0.16 30)"
  cat-azul-tinta: "oklch(42% 0.15 258)"
  cat-oliva: "oklch(48% 0.10 130)"
  cat-ocre: "oklch(68% 0.13 85)"
  cat-vinho: "oklch(42% 0.15 5)"
typography:
  display:
    fontFamily: "'Fraunces', 'Georgia', serif"
    fontSize: "clamp(1.5rem, 3vw, 1.875rem)"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Fraunces', 'Georgia', serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "'Karla', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "'Karla', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  prose:
    fontFamily: "'Karla', system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.78
  eyebrow:
    fontFamily: "'Karla', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.12em"
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
rounded:
  btn: "3px"
  base: "8px"
  md: "12px"
  lg: "16px"
  pleno: "999px"
spacing:
  gutter: "1.5rem"
  gutter-lg: "2.5rem"
  container: "1280px"
  prose: "68ch"
components:
  button-primary:
    backgroundColor: "{colors.primary-coral-terra}"
    textColor: "{colors.bg}"
    rounded: "{rounded.btn}"
    padding: "0.6875rem 1.125rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    border: "1px {colors.border}"
    rounded: "{rounded.btn}"
  color-block:
    note: "post como porta colorida — bg = cor da categoria, texto off-white, número gigante de fundo"
  card-post:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.base}"
  input:
    backgroundColor: "{colors.surface}"
    border: "1px {colors.border}"
    rounded: "{rounded.md}"
---

# Design System: MSIA Scaffold · Café-da-Tarde Editorial

## 1. Overview: A Biblioteca Acolhedora Vira Blog

**Creative North Star: "Cada post é uma porta colorida numa biblioteca calma."**

O scaffold veste a mesma casca **Café-da-Tarde** da plataforma MSIA (canvas
off-white warm, terracota seco como cor de marca, Fraunces serif atenuada + Karla
humanista, zero ornamento), mas aplicada a um **blog editorial**. Onde o dashboard
da plataforma é sóbrio e monocromático, o blog ganha uma camada própria: **5 cores
de categoria committed** que transformam cada post num bloco colorido — a
assinatura visual do scaffold.

Dois ambientes coexistem:
- **Frontend público** (o blog que o leitor vê): editorial, hierarquia de revista,
  blocos de cor, prosa larga com drop cap. Astro estático puro, zero React.
- **Admin embarcado** (`/admin`): product calmo, Café-da-Tarde fiel, vocabulário
  leigo. Ilhas React.

> **A casca esconde um miolo tech-honesto.** O leitor vê uma capa de revista
> brasileira; o editor vê uma ferramenta que salva sem medo. Nenhum dos dois vê
> "deploy", "commit" ou "CMS".

**Key Characteristics:**
- Canvas off-white warm quase neutro (não amarelado) — papel de envelope claro.
- Terracota seco (`coral-terra`) como cor de marca/UI; **5 cores de categoria**
  como sistema editorial de conteúdo.
- Fraunces serif **só em h1/h2 e no drop cap**, weight 400 atenuado; Karla carrega
  todo o resto.
- Post-como-porta-colorida: `.color-block` com número gigante de fundo.
- Botões editoriais de canto quase reto (3px) — mais "imprensa" que "app".
- Sistema flat: profundidade vem de surface contrast e do hover dos blocos, não de
  sombra pesada.
- Motion restrito a state (150–250ms); reduced-motion respeitado globalmente.

## 2. Colors

Fonte de verdade: `src/styles/global.css` (`:root` em RGB com comentário OKLCH) +
`tailwind.config.mjs` (tokens semânticos `bg`, `surface`, `ink`, `cat-*`...).

### Neutrals (canvas warm)
- **bg** (`oklch(97% 0.008 80)` · `250 248 244`): background da página. Off-white
  com hint de warmth, **nunca cream-amarelado saturado**.
- **surface** (`≈ 255 254 251`): cards, inputs — branco microtintado, contraste
  sutil sobre bg sem border.
- **elev** (`oklch(94% 0.012 80)`): elevação sutil, fundo de code inline.
- **border** (`oklch(86% 0.014 80)`): borders de cards/inputs, 1px hairline.
- **rule** (`oklch(81% 0.014 80)`): divisores de seção, hr, scrollbar thumb.

### Ink (texto)
- **ink** (`oklch(15% 0.008 80)` · `20 20 24`): texto primário, headings. **Nunca
  preto absoluto** — é warm-tinted.
- **ink-muted** (`oklch(40% 0.012 80)`): body, descrições (cor default do `<body>`).
- **ink-faint** (`oklch(60% 0.014 80)`): muted, helper, timestamps, labels de seção.

### Primary (UI / marca)
- **coral-terra** (`oklch(45% 0.080 35)` · `139 74 54`): cor de marca do chrome.
  CTA primário, links de UI, accents do admin. Terracota seco profundo, **não
  coral vibrante**. Restrita — não usar em backgrounds grandes.
- **coral-wash** (`oklch(88% 0.025 35)`): variante soft (fundos sutis, hover leve).

### 5 Cores de Categoria — Committed (a assinatura do scaffold)

Cada categoria tem uma cor fixa em OKLCH. O post **herda a cor da sua categoria**
e vira um `.color-block` na home e no hero da página. São cores de **conteúdo
editorial**, não chrome de dashboard — por isso azul-tinta é permitido aqui.

| Categoria | Token | OKLCH | RGB | Uso |
|---|---|---|---|---|
| Comece aqui | `cat-terracota` | `oklch(60% 0.16 30)` | `197 92 62` | bloco terracota |
| Configuração | `cat-azul-tinta` | `oklch(42% 0.15 258)` | `52 88 162` | bloco azul-tinta |
| Conteúdo | `cat-oliva` | `oklch(48% 0.10 130)` | `95 116 54` | bloco oliva |
| Plugins | `cat-ocre` | `oklch(68% 0.13 85)` | `196 152 56` | bloco ocre (**ink escuro**) |
| Inspiração | `cat-vinho` | `oklch(42% 0.15 5)` | `140 52 76` | bloco vinho |

Disponíveis como `bg-cat-*` (fundo de bloco) e `text-cat-*` (cor de texto fora do
bloco). **Committed na safelist** do Tailwind — JIT não detecta `bg-cat-${c}`
interpolado.

### Named Rules

**The Sem-Branco-Sem-Preto Rule.** `#FFFFFF` e `#000000` proibidos. Brancos → `surface`/`bg`;
pretos → `ink`. O sistema inteiro fica warm-tinted.

**The Ocre-Exige-Ink-Escuro Rule.** `cat-ocre` é clara (L 68%). Como fundo de bloco,
o texto vira `ink` escuro (já tratado em `.bg-cat-ocre`), não off-white — senão
quebra WCAG. Toda cor de categoria nova com L > 60% segue a mesma regra.

**The Coral-é-Chrome, Categoria-é-Conteúdo Rule.** `coral-terra` é a cor do *chrome*
(UI, CTA, admin). As 5 cores de categoria são do *conteúdo* (qual seção o post é).
Não misturar papéis: um botão nunca vira azul-tinta; um bloco de post nunca vira
coral-terra (a não ser que "Comece aqui" use terracota, que é próximo mas distinto).

**The Cream-Sem-Amarelo Rule.** Neutrals warm têm chroma baixíssima (0.008–0.014).
Warmth vem do hue (80 = amarelo-quente), nunca da saturação. Cream amarelado é erro.

## 3. Typography

**Display:** `Fraunces` (variable, Google Fonts) · fallback `Georgia, serif`.
**Body:** `Karla` (Google Fonts) · fallback `system-ui, sans-serif`.
**Mono:** `JetBrains Mono` · fallback `ui-monospace`.

> README diz "Switzer" — **incorreto**. O código (`global.css`) usa Fraunces + Karla.

**Character:** Fraunces dá personalidade editorial **atenuada** — h1/h2 e o drop cap,
weight 400, tracking apertado. Karla (humanista calorosa) carrega botões, labels, nav,
body, prosa. Mono pra dados (domínios, labels de seção da sidebar).

### Hierarchy (valores reais)
- **h1 / Display** (Fraunces 400, `clamp(1.5rem, 3vw, 1.875rem)` ≈ 24–30px, lh 1.15,
  tracking -0.02em): título de hero/home. **Atenuada** — nunca weight 500+ nem 40px+.
- **h2 / Headline** (Fraunces 400, 1.5rem, lh 1.2, tracking -0.015em): seções.
  No prose do post, h2 sobe pra 1.875rem (`.prose-msia h2`).
- **h3** (Karla 600, 1rem, lh 1.4): título de card, subsção. **Karla, nunca Fraunces.**
- **h4** (Karla 600, 0.9375rem): sub-subsção.
- **Body** (Karla 400, 1rem, lh 1.65): default do `<body>`.
- **Prose** (Karla 400, **1.125rem, lh 1.78**, max 68ch): corpo do post — mais larga
  e arejada que o body do chrome, pra leitura longa confortável.
- **Eyebrow** (Karla 700, 0.75rem uppercase, tracking 0.12em): rótulo categórico.
- **Mono / label de sidebar** (JetBrains Mono, 0.6875–0.75rem): domínios, IDs,
  `side-section-label`.

### Named Rules

**The Floor-12 Rule.** Nenhum conteúdo abaixo de 12px (`text-xs`). Eyebrows com tracking
podem ir a 11px só em uso categórico. Público 40+ com presbiopia — floor é a11y crítica.

**The Serif-Pra-Voz Rule.** Fraunces só em h1, h2 e no drop cap (`first-letter`). Botões,
labels, nav, body, h3+ são Karla. Serif em UI utilitária é AI slop.

**The Fraunces-Atenuada Rule.** h1 = weight 400, clamp(1.5rem, 3vw, 1.875rem),
tracking -0.02em. Hero pesado demais (weight 500+, 40px+) é rejeitado.

**The Drop-Cap-é-Assinatura Rule.** O primeiro parágrafo do post (`.prose-msia > p:first-of-type::first-letter`)
abre com capitular Fraunces 4.5em weight 800. É o momento editorial do post — manter,
não multiplicar (uma por artigo).

## 4. Elevation

Sistema **flat com tonal layering warm**. Profundidade vem de surface contrast
(`bg` → `surface` → `elev`), não de sombra pesada. O blog público mal usa sombra;
a profundidade no frontend vem do **hover dos color-blocks** (`filter: brightness(1.06)
saturate(1.05)` + `scale(0.995)` no active). Sombras, quando existirem (admin),
devem ser warm-terra, **nunca `rgba(0,0,0,X)`**.

**The Flat-By-Default Rule.** Cards, inputs, nav, badges — flat em rest. No frontend,
movimento é o brightness/scale dos blocos; no admin, leve elevação em hover só onde fizer sentido.

## 5. Components

Fonte de verdade: `@layer components` em `global.css` + `src/components/`.

### Color-Block — Signature Component
A peça assinatura. O post renderizado como **porta colorida**:
- `.color-block`: flex column, `padding 2rem`, texto off-white (`248 248 246`),
  `bg-cat-*` da categoria. Variantes `-lg` (min-height 60vh, padding 3–4rem) e
  `-md` (32–38vh).
- `.color-block-num`: número gigante de fundo (Fraunces 900, `clamp(12rem, 28vw, 22rem)`,
  `rgba(255,255,255,0.10)`) — textura sutil, `z-index: -1`, `pointer-events: none`.
- Hover: `brightness(1.06) saturate(1.05)`; active: `scale(0.995)`. Transição
  250ms `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Ocre inverte**: número e texto viram ink escuro (cor clara exige contraste).

### Buttons
- `.btn`: Karla 500, 0.875rem, padding `0.6875rem 1.125rem`, **`border-radius: 3px`**
  (canto quase reto, editorial — divergência consciente do app, que usa 12px),
  transição 150ms.
- `.btn-primary`: bg `coral-terra`, text `bg`. Hover: `brightness(0.88)`.
- `.btn-ghost`: transparente, text `ink`, border `border`. Hover: border vira `ink`.
- **Touch target floor: 44×44px** — botões compactos compensam com min-height.

### Cards (post)
`PostCard` variants (`PostCardLarge/Medium/List`): surface elevada de `bg` pra
`surface`, `rounded` base (8px), border hairline ou invisível, `CategoryBadge` com
`text-cat-*`. Sem `scale-110` no hover — sutil.

### Prose (corpo do post) — `.prose-msia`
- 1.125rem / lh 1.78 / max 68ch / cor `ink-muted`.
- **Drop cap** no primeiro parágrafo (ver Named Rules).
- h2 (1.875rem, tracking -0.022em), h3 (1.375rem), ambos cor `ink`.
- Links: `ink` com underline 1px cor `rule`, offset 3px; hover underline currentColor.
- Blockquote: border-left 2px `ink`, itálico 1.5rem weight 500.
- Code inline: mono, bg `elev`, radius 2px. Pre: bg `ink`, text `elev`, radius 4px.
- `.listicle-item`: border-top `rule`, espaçamento generoso.

### Inputs
`surface`, border 1px `border`, `rounded-md` (12px), body Karla. Focus: border
`coral-terra` (sem glow/ring colorido — só border muda).

### Navigation
- **Sidebar** (`.side-section` + `.side-section-label`): label em mono 0.6875rem
  `ink-faint`, border-bottom `rule`. Enxuta, agrupada por seção.
- **Header / Footer**: continuidade com `bg`, divisor hairline `rule`.

### Misc
- `.container-x`: max 1280px, padding-inline 1.5rem (2.5rem md+).
- `.mono`: JetBrains Mono 0.75rem pra dados.
- Scrollbar custom warm; `::selection` coral-terra 18%.

## 6. Do's and Don'ts

### Do
- **Do** usar `bg` (`oklch(97% 0.008 80)`) como background — off-white warm, não amarelado.
- **Do** texto em `ink` (warm), nunca `#000`.
- **Do** restringir `coral-terra` ao chrome (CTA, links de UI, admin).
- **Do** usar as 5 cores de categoria como sistema de conteúdo — cada post herda a sua.
- **Do** Fraunces só em h1, h2 e drop cap, weight 400. Resto é Karla.
- **Do** floor de 12px em conteúdo.
- **Do** mono `JetBrains Mono` pra dados (domínios, IDs, labels de seção).
- **Do** vocabulário PT-BR leigo: "publicar" não "deploy", "salvar" não "commit".
- **Do** touch targets ≥ 44×44px.
- **Do** respeitar `prefers-reduced-motion` (já global em `global.css`).
- **Do** ink escuro em fundo `cat-ocre` (cor clara) e em qualquer categoria L > 60%.

### Don't
- **Don't** dark mode, roxo (`#7c3aed`), aurora orbs, glassmorphism, shimmer, pulseGlow
  infinito. (Anti-ref #1 dev-tool.)
- **Don't** pastel/cartoon (anti-ref #2), verde-amarelo agressivo de funil (anti-ref #3).
- **Don't** confundir o azul-tinta de categoria com chrome azul de WordPress (anti-ref #4).
  Azul-tinta é só fundo de bloco de post "Configuração", nunca UI.
- **Don't** Fraunces em botão, label, nav, h3+. Serif em UI utilitária é AI slop.
- **Don't** Fraunces em hero weight 500+ ou 40px+. Atenuada = 400 + clamp(1.5rem, 3vw, 1.875rem).
- **Don't** cream com chroma > 0.014. Amarelado saturado é erro.
- **Don't** sombra preta neutra (`rgba(0,0,0,X)`) — usar warm-terra.
- **Don't** em-dashes (`—`) em copy PT-BR. Usar vírgula, dois-pontos, parênteses. Em-dash é tell de AI.
- **Don't** React no frontend público do blog (peso de bundle) — só no admin.
- **Don't** card-everything no admin. Conteúdo solto com hierarquia editorial > grid de cards decorativos.

---

**Audit tests** (uma linha cada, pra checar drift):
- *"Se o canvas aparece visivelmente amarelado, chroma alta demais — abaixar pra ~0.008."*
- *"Se um botão ou label está em Fraunces, serif fora do lugar — trocar pra Karla."*
- *"Se um bloco de post `ocre` tem texto claro, contraste quebrado — inverter pra ink escuro."*
- *"Se coral-terra vira fundo de bloco de post, papel trocado — bloco usa cor de categoria."*
- *"Se o frontend do blog carrega React, peso indevido — mover interatividade pro admin."*
- *"Se o user leigo lê 'deploy', 'commit', 'tokens' ou 'CMS' na tela, vocabulário falhou."*
- *"Se uma label tem 8/9/10/11px, abaixo do floor-12 — sobe pra 12px+."*
- *"Se há mais de uma animação infinita por tela, motion overload — cortar pra zero."*
- *"Se aparece `#7c3aed` ou roxo, legado dev-tool — trocar por coral-terra ou neutro."*
