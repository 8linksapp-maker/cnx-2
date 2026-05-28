# CLAUDE.md — msia-scaffold

> Contexto técnico do projeto pra qualquer agente Claude que iniciar sessão
> aqui. Atualize quando: stack mudar, padrão de código mudar, comando
> importante for adicionado, ou decisão arquitetural for tomada.

## O que é este projeto

Base reutilizável (scaffold) pra criar blogs com **admin embarcado** + 14
plugins prontos. Cada site da rede MSIA nasce de um `bun create` deste repo.
É o **artefato que vai pro ar** por trás de cada blog — não confundir com a
plataforma `meu-site-com-ia-2.0` (o dashboard SaaS onde o usuário gerencia a
carteira de sites). Aqui mora o *site individual* + o CMS que edita ele.

## Stack

- **Astro 5.1** — `output: 'static'` com adapter **Vercel** → na prática é
  **static-first híbrido**: páginas de blog são pré-renderizadas (CDN), e o
  admin (`/admin/*`) + API (`/api/admin/*`) + redirects rodam **on-demand**
  via `src/middleware.ts`. Rotas dinâmicas marcam `export const prerender = false`.
- **React 18** (`@astrojs/react`) — só nas ilhas do admin (editores `.tsx`).
- **Tailwind 3** (`@astrojs/tailwind`, `applyBaseStyles: false`) — base styles
  vêm de `src/styles/global.css`, não do preflight.
- **Bun** — package manager e runtime de dev.
- `@tailwindcss/typography`, `marked` (markdown→html), `react-quill-new`
  (WYSIWYG do editor), `jszip` (backup/import), `fast-xml-parser` (WP importer),
  `lucide-react` (ícones do admin).

## Comandos essenciais

- `bun install` — instala deps
- `bun run dev` — sobe local em `http://localhost:4321` (admin em `/admin`)
- `bun run build` — build de produção (lê `src/data/siteConfig.json` pra `site:`)
- `bun run preview` — preview do build

> Pra inspecionar o dev server local, use `curl http://localhost:4321/...`
> (WebFetch é bloqueado em loopback).

## Estrutura

```
src/
├── content/blog/        ← posts em Markdown (frontmatter + corpo)
├── data/                ← config + dados editáveis pelo admin (JSON)
│                          siteConfig, categories, authors, menu, home,
│                          sobre, contato, privacy, terms, pluginsConfig,
│                          redirects, subscribers...
├── pages/
│   ├── admin/           ← painel (ilhas React, prerender=false)
│   ├── api/admin/       ← endpoints CRUD do CMS (prerender=false)
│   ├── api/cron/        ← jobs agendados
│   ├── [slug].astro     ← template do post
│   ├── categoria/       ← arquivos por categoria
│   └── blog/, posts/    ← listagens
├── components/
│   ├── admin/           ← editores React: PostEditor, ConfigEditor,
│   │                       CategoriesEditor, AuthorsEditor, MenuEditor,
│   │                       PostsManager, DeployManager, BackupManager...
│   ├── sections/        ← seções da home (Hero, Categories, LatestPosts...)
│   ├── blog/            ← PostCard variants, CategoryBadge
│   ├── layout/, sidebar/, ui/
├── plugins/             ← 14 plugins (cada um em sua pasta)
├── layouts/
├── lib/                 ← helpers (ver abaixo)
├── styles/global.css    ← design system: tokens OKLCH + componentes
└── middleware.ts        ← auth do admin + redirects públicos
```

### lib/ — helpers-chave

- `auth.ts` — sessão do admin (`validateSession`, cookie). Senha = `ADMIN_SECRET`.
- `readData.ts` — lê os JSON de `src/data/`.
- `repoAtomicCommit.ts` — **commit atômico via GitHub Tree API** (escreve N
  arquivos num único commit). É como o admin persiste edições em produção.
- `repoIo.ts` — leitura/escrita de arquivos no repo (local dev = fs, prod = API).
- `categoryColors.ts` / `categorySlug.ts` — mapeia categoria → cor committed + slug.
- `postUrl.ts`, `slugify.ts`, `shortcodes.ts`, `videoEmbed.ts`, `yamlEscape.ts`.
- `vercelJson.ts`, `robotsDefault.ts`, `templateConfig.ts`.

## Padrões de código

- **Dados editáveis vivem em `src/data/*.json`**, não hardcoded em componentes.
  Componentes leem via `readData()`. Pra tornar algo editável, mova pra JSON.
- **Admin = ilhas React**; site público = Astro estático. Não misturar: nada de
  React no frontend do blog (peso de bundle).
- **Persistência em prod passa por `repoAtomicCommit`** — não escrever no fs em
  runtime de produção (filesystem da Vercel é read-only/efêmero). Local dev
  escreve no fs direto.
- **Plugins desativados por default.** Cada plugin lê seu config de
  `pluginsConfig.json`; render condicional ao `enabled`.
- **Vocabulário PT-BR leigo** em toda UI (ver PRODUCT.md / DESIGN.md):
  "publicar" não "deploy", "online" não "NO AR".

## Gotchas / armadilhas conhecidas

- **README está desatualizado em 2 pontos** (código é a fonte de verdade):
  1. README diz "Switzer" como fonte → `global.css` usa **Fraunces + Karla**.
  2. README diz "SSR" → `astro.config` é `output: 'static'` (híbrido on-demand).
- **`output: 'static'` engana** — admin/API só funcionam porque o adapter Vercel
  serve rotas `prerender = false` on-demand. Em `build` puro sem adapter, o admin
  não roda.
- **Sitemap é opcional** (`require` em try/catch no astro.config). Se a dep não
  estiver instalada, build não quebra — só não gera sitemap.
- **`siteConfig.json.url` é lido em build-time** pro `site:` do Astro (canonical,
  sitemap). Mudar a URL exige rebuild.
- **Cores de categoria são committed via safelist** no `tailwind.config.mjs`
  (`bg-cat-*`, `text-cat-*`) — o JIT não detecta `bg-cat-${c}` interpolado, por
  isso a safelist. Adicionar categoria nova = adicionar na safelist.
- **Tela de fallback do middleware** (sem `ADMIN_SECRET`) é HTML inline com CSS
  próprio (não carrega `global.css`). Já alinhada à paleta Café-da-Tarde —
  ao editá-la, manter cores warm (`rgb(...)` da paleta), nunca slate/roxo.

## Deploy

- Hospedagem: **Vercel** (adapter `@astrojs/vercel`).
- Env vars críticas (`.env` local / Vercel em prod):
  - `ADMIN_SECRET` — senha do admin (sem ela, `/admin` mostra tela de aviso).
  - `GITHUB_TOKEN` / `GITHUB_OWNER` / `GITHUB_REPO` — PAT + repo pro
    `repoAtomicCommit` persistir edições em produção.
- Fluxo de criação de site novo: `bun create github:8linksapp-maker/msia-scaffold meu-blog`
  (degit, clona sem `.git`, roda `bun install`).

## Stakeholders

- Bruno (owner / orquestrador)
- Personas de trabalho (modo invocação direta — ver `.agents/` se existir)

## Docs irmãos

- `PRODUCT.md` — quem usa, brand, anti-references, princípios (compartilha DNA
  com `meu-site-com-ia-2.0`, escopado pro contexto blog).
- `DESIGN.md` — tokens reais do scaffold (OKLCH), tipografia, componentes,
  do's & don'ts. **Fonte de verdade visual.**
- `PLUGIN_SYSTEM.md` — arquitetura dos 14 plugins.
