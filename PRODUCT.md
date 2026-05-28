# Product — msia-scaffold

> Este scaffold é parte da plataforma **MSIA** (`meu-site-com-ia-2.0`).
> Herda o mesmo DNA de marca, audiência e princípios; este doc escopa esse DNA
> pro que o scaffold *é*: o **blog individual + o CMS embarcado** que cada
> usuário publica e edita. Onde divergir da plataforma, está anotado.

## Register

product (admin embarcado) + brand/editorial (frontend público do blog)

> Dois registers convivem aqui. O **admin** (`/admin/*`) é product: ferramenta
> de trabalho, calma, vocabulário leigo. O **frontend do blog** é editorial:
> a "porta colorida" de cada post, hierarquia de revista. O DESIGN.md detalha
> como cada um se comporta.

## Users

A MSIA serve quatro perfis, todos brasileiros, em sua maioria sem fluência
técnica. No contexto do scaffold, eles aparecem em **dois papéis**:

**Quem edita (admin):**
1. **Iniciantes em web sem programação** — primeira presença online.
2. **Freelancers (R$ 800–6.000 por site)** — a MSIA é a ferramenta de produção;
   o admin precisa parecer profissional o suficiente pra mostrar pro cliente final.
3. **Afiliados de renda passiva** — monetizam via SEO + links de afiliado, rodam
   vários sites por nicho.
4. **Negócios locais** — médico, salão, advogado, loja de bairro.

**Quem visita (frontend):** o público final de cada blog — leitor do nicho.
Não loga, não edita, chega via SEO/social. Pra ele o que importa é leitura
limpa, carregamento rápido e mobile impecável.

**Contexto de uso (editor):** desktop/notebook, sessão 15–60 min, fora do
horário comercial. Idade 30–55, presbiopia provável, baixa paciência com jargão.

**Job to be done principal:** *publicar e manter conteúdo de um blog sem tocar
em código*. Escrever post, organizar categorias, ligar um plugin de SEO/afiliado,
publicar — tudo pelo painel, sem GitHub, sem terminal.

## Product Purpose

O scaffold é a **base completa de um blog com CMS embarcado**:

- Frontend de blog editorial (home com posts como blocos coloridos, página de
  post com prosa cuidada, arquivos por categoria, páginas institucionais).
- Admin embarcado (`/admin`) pra editar conteúdo, config, autores, menu,
  categorias e páginas — com editor WYSIWYG estilo WordPress.
- 14 plugins prontos (SEO, GA4, Meta Pixel, Email List, Cookie Consent,
  Affiliates, AdSense, Related Posts, Social Share, Redirects, AI Generator,
  WP Importer, Search Console, Slots) — todos desligados por default.
- Persistência via commit atômico no GitHub (o usuário não vê isso; pra ele é
  só "salvar" e "publicar").

**Sucesso de produto (scaffold):** o usuário consegue publicar/editar um post
e ligar um plugin sem ajuda técnica, e o resultado é um blog rápido, acessível e
que ele tem orgulho de mostrar. Métrica herdada da plataforma (em aberto):
activation (publica primeiro post em 7 dias) + retention (volta e edita de novo).

## Brand Personality

**Três palavras:** amigo, didático, brasileiro.

**Tom:** caloroso sem ser infantil. Explica do zero sem fazer o usuário se sentir
burro. Profissional o bastante pra um freelancer mostrar pro cliente, sem a
rigidez de ferramenta corporativa.

**Voz:** PT-BR natural, pronome "você", linguagem clara. Bom-humor brasileiro
contido (não memes, não emoji decorativo, não gírias datadas). Frases curtas,
diretas. Nunca jargão técnico sem tradução imediata.

**Emoções a evocar:**
- **Confiança calma** ("você tá em boas mãos, vai dar certo").
- **Capacidade pessoal** ("eu consegui sozinho, sem ajuda de TI").
- **Orgulho de mostrar** (o blog e o painel são bonitos o suficiente pra mostrar
  pro cliente do freelancer, ou pro filho/neto).

## Anti-references

A MSIA explicitamente NÃO pode parecer:

1. **Ferramenta dev tipo Linear / Vercel / Stripe** (dark + roxo + aurora orbs +
   glassmorphism + ícones Sparkles/Rocket/Zap). Reflex de categoria mais batido
   de 2024–2026, fala uma língua que o usuário leigo não entende.
2. **Wix / Squarespace genérico** (pastel + ilustrações cartoon + tom
   over-friendly). "No-code amigável" banalizado; a MSIA quer parecer mais adulta.
3. **Hotmart / Kiwify de infoproduto** (verde + amarelo + CTAs gritando "compre
   agora" + faixas de desconto). Visual agressivo de funil que derruba percepção
   de qualidade.
4. **WordPress dashboard clássico** (azul-cinza denso + UI datada + tipografia
   pequena). A MSIA é a alternativa moderna a isso — não pode lembrar o velho.

**Implicação combinada:** sobra um espaço inexplorado. Direção visual **quente
sem ser cartoon, brasileira sem ser clichê tropical, profissional sem ser fria,
premium sem ser dev-tool** — cerâmica / terracota / café-da-tarde, tipografia
editorial-mas-amigável, hierarquia editorial em vez de "card-everything".

> **Nota de divergência (scaffold):** o frontend do blog usa **5 cores de
> categoria committed** (terracota, azul-tinta, oliva, ocre, vinho) como sistema
> de categorização editorial — incluindo um azul. Isso **não** contradiz o
> anti-ref #1/#4: o azul-tinta é cor de *conteúdo categórico* (um post de
> "Configuração"), não chrome de dashboard. O admin segue a paleta Café-da-Tarde
> sem azul. Ver DESIGN.md §Cores.

## Design Principles

1. **Vocabulário do usuário, não da plataforma.** Toda palavra técnica é uma
   porta fechada. "Deploy" → "publicar", "CMS" → "editar site", "tokens" →
   "conectar suas contas", "commit" → "salvar". Quem fala dev-tools fala pra
   desenvolvedor; a MSIA fala pra cabeleireira de Goiânia.

2. **Calma > estímulo.** O usuário tá nervoso ("vou conseguir?"). O painel baixa
   a frequência cardíaca, não acelera. Motion contido, hierarquia clara,
   reasseguramento em vez de pirotecnia.

3. **Confiança via craft, não via decoração.** Wow vem de detalhe bem-feito
   (tipografia honesta, cor com intenção, espaçamento rítmico), não de animação
   infinita, gradient ou glow. O cliente do freelancer pensa "esse cara usa
   ferramenta séria".

4. **Distinção é estratégia.** Em categoria saturada, o caminho pro "wow"
   memorável é não parecer com nenhum dos quatro reflexos batidos. Comprometer
   com uma direção autoral é menos arriscado que diluir entre clones.

5. **Frontend serve o leitor; admin serve o editor.** No blog, a leitura manda:
   prosa larga, mobile primeiro, carregamento rápido (zero React no público).
   No admin, a edição manda: feedback claro, salvar sem medo, sem jargão.

## Accessibility & Inclusion

**Nível de compromisso:** WCAG AA é obrigatório. A LBI (13.146/2015) aplica a
produtos digitais comerciais no Brasil; além disso, a audiência declarada
(30–55 anos com presbiopia provável) faz da acessibilidade requisito de produto.

**Requisitos mínimos:**
- **Contraste:** texto regular ≥ 4.5:1, large/bold ≥ 3:1. Validar antes de merge.
  (Atenção às cores de categoria como fundo: `ocre` é clara → exige ink escuro;
  já tratado no `global.css`.)
- **Tipografia floor:** 12px (`text-xs`). Nada de conteúdo abaixo. Eyebrows
  uppercase com tracking podem ir a 11px só em uso categórico.
- **Touch targets:** mínimo 44×44px em todo elemento clicável.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` global já presente
  em `global.css` — manter ao adicionar animação nova.
- **Ícones acessíveis:** `aria-label` em todo botão/link ícone-only.
- **Foco visível:** outline explícito em todo interativo, não confiar no default.
- **Estrutura semântica:** landmarks corretos, `lang="pt-BR"` no root, labels em forms.

**Audiência específica:** público 30–55, presbiopia provável após 40. Tipografia
clara e contraste forte são features críticas, não acessibilidade-extra.
