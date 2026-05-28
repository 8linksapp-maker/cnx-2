# MSIA Scaffold

Base completa pra criar blogs com Astro + admin embarcado + 14 plugins prontos.

Stack: Astro 5 SSR · Tailwind 3 · React 18 · Bun · Vercel adapter

## Criar novo blog a partir deste scaffold

```bash
bun create github:8linksapp-maker/msia-scaffold meu-blog
cd meu-blog
bun install
bun run dev
```

O comando `bun create github:...` faz **degit** automático — clona sem `.git` e roda `bun install`. Depois disso é só rodar `bun run dev` e abrir `http://localhost:4321`.

## Primeira configuração

Em paralelo ao `bun run dev`, abra `http://localhost:4321/admin` e logue com a senha do `.env` (`ADMIN_SECRET`).

Os 5 ajustes mais importantes:

1. `/admin/config` — nome do blog, descrição, cor primária, logo, favicon
2. `/admin/menu` — items do header
3. `/admin/categories` — suas categorias (default já tem 5)
4. `/admin/sobre` + `/admin/contato` — páginas estáticas
5. `/admin/posts` — primeiro post

Os 5 posts institucionais que vêm no scaffold (`/01-comece-aqui`, `/02-configuracao`, etc) são manual embarcado — leia eles antes de apagar.

## Deploy no Vercel

```bash
# Configure env vars no painel Vercel:
ADMIN_SECRET=<senha-do-admin>
GITHUB_TOKEN=<personal-access-token>
GITHUB_OWNER=<seu-usuario>
GITHUB_REPO=<repo-do-blog>
```

Conecte o repo do blog ao Vercel e faça deploy. O admin escreve no GitHub via Octokit; cada save = commit. Vercel rebuilda automático.

## Estrutura

```
src/
├── content/blog/        ← posts em Markdown
├── data/                ← config + dados editáveis pelo admin (JSON)
├── pages/               ← rotas Astro
│   ├── admin/           ← painel administrativo
│   └── [slug].astro     ← template do post
├── components/          ← UI components
├── plugins/             ← 14 plugins (SEO, AI, Email, Affiliates, etc)
├── layouts/
├── lib/                 ← helpers (categoryColors, slugify, readData)
└── styles/global.css    ← design system + tokens OKLCH
```

## Design system

- **Tema**: light por default (off-white warm canvas)
- **Tipografia**: Switzer (variable, Fontshare) + JetBrains Mono pra accents
- **Cores categoria** (5, committed OKLCH, fixas no scaffold):
  - Comece aqui · terracota `#c55c3e`
  - Configuração · azul-tinta `#3458a2`
  - Conteúdo · oliva `#5f7436`
  - Plugins · ocre `#c49838`
  - Inspiração · vinho `#8c344c`

Cada post herda a cor da sua categoria — vira um bloco colorido na home e no hero da página.

## Plugins inclusos

| Plugin | O que faz |
|---|---|
| SEO | Schema.org Article/Breadcrumb/Website |
| Google Search Console | Meta de verificação |
| Google Tag (GA4) | Tracking |
| Meta Pixel | Tráfego pago |
| Email List | Brevo (popup/inline/sidebar) |
| Cookie Consent | LGPD/GDPR |
| Affiliates | Cards Amazon |
| AdSense | Header injection |
| Related Posts | 3 artigos automáticos |
| Social Share | Botões de compartilhamento |
| Redirects | 301 sem mexer no código |
| AI Generator | OpenAI + Pexels |
| WP Importer | XML do WordPress |
| Slots | Esqueleto interno |

Configurar em `/admin/plugins` (todos desativados por default).
