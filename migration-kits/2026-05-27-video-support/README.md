# Migration Kit — Video Support

**Data:** 2026-05-27
**Aplicável a:** sites MSIA com `src/content/config.ts` (Zod schema do blog collection)
**Risco:** baixo (parte automática é aditiva)
**Idempotente:** sim

---

## Contexto

Suporte estrutural a vídeo nos artigos. Aluno passa a poder:

1. **Adicionar campo `videoUrl` no frontmatter** do post → vídeo renderiza como hero ou after-hero
2. **Usar shortcode `[[video:URL]]` no body** → embed responsivo 16:9 em qualquer lugar do texto

Providers suportados: **YouTube**, **Vimeo**, **mp4 self-hosted**, **Loom**, **Wistia**, **Brightcove**, **JWPlayer**, **Spotify**, **Twitch**.

SEO automático: **VideoObject JSON-LD** emitido pelo `<PostVideo />` quando renderizado.

---

## Tier A — Automático (apply.mjs)

```bash
node apply.mjs <repoPath>
```

Faz:

| Passo | Arquivo / Ação |
|---|---|
| 1 | `src/lib/videoEmbed.ts` ← cria (parser YouTube/Vimeo/iframe/mp4) |
| 2 | `src/components/ui/PostVideo.astro` ← cria (component responsivo + JSON-LD) |
| 3 | `src/lib/shortcodes.ts` ← se não existir, cria minimal só com `[[video:]]`. Se existir, **NÃO sobrescreve** — registra como `manual-merge-required` |
| 4 | `src/content/config.ts` ← patch Zod schema (adiciona `videoUrl` + `videoPosition`) |
| 5 | `bun run build` (ou npm/yarn/pnpm) |

**Comportamento idempotente:**
- Arquivos novos com conteúdo idêntico → `status: identical`
- Arquivos com conteúdo divergente → `status: differs, skipped: true` (não sobrescreve)
- Schema já tem `videoUrl` → `status: already-patched`

**Exit codes:**
- `0` — sucesso (aplicado ou já estava)
- `1` — falha (path missing, JSON inválido, build quebrou)
- `2` — uso incorreto

---

## Tier B — Manual (template-specific)

O kit **não toca** em arquivos cujo layout varia entre templates (walker / TechMaster / AutoReview / ClickBanker). São 2 categorias:

### 1. Page renderers (`pages/[slug].astro` + `pages/blog/[slug].astro`)

Pra renderizar vídeo **como hero do post** (via frontmatter), você precisa adicionar 3 coisas:

**a)** Import no topo:
```astro
import PostVideo from '../components/ui/PostVideo.astro';
import { parseVideoUrl } from '../lib/videoEmbed';
```

**b)** Setup das vars antes do markup:
```ts
const videoUrl = post.data.videoUrl || '';
const videoInfo = videoUrl ? parseVideoUrl(videoUrl) : null;
const hasValidVideo = videoInfo && videoInfo.provider !== 'unknown';
const videoPosition = post.data.videoPosition || 'after-hero';
```

**c)** Markup (substitui o hero image atual):
```astro
{hasValidVideo && videoPosition === 'hero' ? (
  <PostVideo url={videoUrl} title={post.data.title} description={post.data.description}
             uploadDate={post.data.pubDate.toISOString()} lite={true} />
) : post.data.heroImage ? (
  <img src={post.data.heroImage} alt="" />
) : null}

{hasValidVideo && videoPosition === 'after-hero' && (
  <PostVideo url={videoUrl} title={post.data.title} description={post.data.description}
             uploadDate={post.data.pubDate.toISOString()} lite={true} />
)}
```

### 2. Render do shortcode `[[video:URL]]` no body

Se o page renderer ainda não chama `renderShortcodes`, adicionar:

```astro
---
import { renderShortcodes, hasShortcodes } from '../lib/shortcodes';

const rawBody = (post.body || '') as string;
const isHtmlBody = /^\s*</.test(rawBody.trim());
const processedHtml = isHtmlBody && hasShortcodes(rawBody) ? renderShortcodes(rawBody) : null;
---

<!-- substituir <Content /> por: -->
{processedHtml ? <Fragment set:html={processedHtml} /> : <Content />}
```

> O kit retorna em `steps.pageRenderers` qual o estado atual de cada página (`has-shortcodes` / `plain-content` / `not-found`). Use isso pra saber se precisa do passo Tier B.

### 3. PostEditor.tsx (UI no admin)

**Não é obrigatório.** Aluno pode digitar `[[video:URL]]` direto no Quill editor — o shortcode funciona sem UI dedicada.

Se quiser UI:
- Cole o bloco "Vídeo do artigo" do scaffold (`src/components/admin/PostEditor.tsx` — bloco com `<Video className="w-4 h-4 text-rose-500" />`)
- E o botão "Inserir vídeo" acima do editor Quill (modal com input URL)

---

## Caminho mínimo viável (sem Tier B)

Aluno **digita `[[video:URL]]` no body** via Quill ou markdown direto. O shortcode renderiza embed responsivo 16:9 com lazy-load iframe + VideoObject JSON-LD pra SEO.

**Isso funciona em 100% dos templates** desde que:
- `src/lib/shortcodes.ts` existe e tem `renderShortcodes` exportado (kit cuida disso)
- Page renderer chama `renderShortcodes(post.body)` ANTES de servir o HTML (Tier B passo 2 se ainda não)

---

## Output JSON do apply.mjs

```json
{
  "repo": "<path>",
  "success": true,
  "steps": {
    "prereqs": { "ok": true, "pm": "bun" },
    "videoEmbed": { "status": "created" },
    "postVideo": { "status": "created" },
    "shortcodes": { "status": "created-minimal" },
    "contentConfig": { "ok": true, "status": "patched" },
    "pageRenderers": {
      "src/pages/[slug].astro": "plain-content",
      "src/pages/blog/[slug].astro": "plain-content"
    },
    "build": { "ok": true, "code": 0 }
  },
  "manual_steps": [
    "page-renderer: src/pages/[slug].astro renderiza <Content /> direto sem processar shortcodes. Adicionar import + chamada renderShortcodes.",
    "page-renderer: src/pages/blog/[slug].astro renderiza <Content /> direto...",
    "post-editor-ui: PostEditor.tsx não foi tocado..."
  ]
}
```

Use `manual_steps` pra triar quais repos precisam acompanhamento.

---

## Checklist por repo

- [ ] `node apply.mjs <repo>` exit 0
- [ ] `steps.contentConfig.ok = true`
- [ ] `steps.build.ok = true`
- [ ] Revisar `manual_steps` — se houver `plain-content` em page renderers, decidir se aplica Tier B agora ou deixa pra quando aluno reclamar
- [ ] Commit + push

## Commit message sugerida

```
feat(video): suporte a vídeos em posts via frontmatter + shortcode

- src/lib/videoEmbed.ts: parser YouTube/Vimeo/iframe/mp4
- src/components/ui/PostVideo.astro: embed responsivo 16:9 com lite mode + JSON-LD
- src/lib/shortcodes.ts: [[video:URL]] inline no body (minimal se ausente)
- src/content/config.ts: campos videoUrl + videoPosition no schema

Aluno usa via:
  1. frontmatter: videoUrl + videoPosition (requer Tier B no page renderer)
  2. shortcode: [[video:URL]] no body (funciona out of the box)

via migration-kit/2026-05-27-video-support
```

## Rollback

```bash
git revert <commit>
git push
```

Schema Zod aceita campos opcionais, então posts antigos sem videoUrl continuam validando após revert do schema. Rollback é limpo.
