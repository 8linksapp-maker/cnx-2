# Migration Kit — URL Prefix Fix

**Data:** 2026-05-26
**Aplicável a:** todos os sites MSIA com `src/pages/[slug].astro` + `src/pages/blog/[slug].astro`
**Risco:** baixo (mudança aditiva no `getStaticPaths`, sem breaking)
**Validação:** `bun run build` exit 0

---

## O bug

A rota `src/pages/[slug].astro` da raiz sempre gerava posts (sem condicional). A rota `src/pages/blog/[slug].astro` só gerava quando `siteConfig.postUrlPrefix === 'blog'`.

**Resultado:** quando aluno escolhia "URL com /blog/" no admin, o site servia **o mesmo post em duas URLs**:
- `/post-titulo` ← rota raiz gerou
- `/blog/post-titulo` ← rota /blog/ gerou

Isso é duplicação de conteúdo SEO — penalização certa pelo Google.

## A fix

Adiciona a mesma condicional no `[slug].astro` raiz, mas invertida:

```diff
 export async function getStaticPaths() {
+  const siteConfig = readData('siteConfig.json', {}) as any;
+  // Quando aluno escolheu prefixo /blog, esta rota nao gera (evita duplicacao com /blog/[slug]).
+  if (siteConfig?.postUrlPrefix === 'blog') return [];
   const posts = await getCollection('blog');
   return posts.map(...);
 }
```

Comportamento resultante:
- `postUrlPrefix === ''` (default) → só `/post` gera. `/blog/post` retorna 404 (redirect 301 vai cuidar).
- `postUrlPrefix === 'blog'` → só `/blog/post` gera. `/post` retorna 404 (redirect 301 vai cuidar).

Sem duplicação, comportamento correto em ambos os modos.

## Componente complementar — redirect 301

O endpoint `/api/admin/github` já sincroniza `vercel.json` com:
- Se `postUrlPrefix === ''`: adiciona redirect `/blog/:slug* → /:slug*`
- Se `postUrlPrefix === 'blog'`: remove esse redirect

Esse comportamento **já existia** no scaffold antes desta migration. Não precisa patch.

> ⚠️ A direção inversa (`/post → /blog/post` quando aluno migra DE limpa PARA com prefix) **não está coberta** automaticamente. Se for caso comum, abrir issue.

---

## Uso

```bash
node apply.mjs <caminhoDoRepoClonado>
```

O script:
1. Verifica que `src/pages/[slug].astro` existe
2. Detecta se patch já foi aplicado (idempotente)
3. Adiciona `import { readData }` se faltar
4. Insere as 3 linhas na `getStaticPaths`
5. Roda `bun run build` (ou npm/yarn/pnpm conforme lockfile)
6. Retorna JSON com resumo em stdout

**Exit codes:**
- `0` — sucesso (patched ou já estava aplicado)
- `1` — falha (path não existe, regex não casou, build quebrou) — ver JSON em stdout
- `2` — uso incorreto

**Não commita.** Quem chama decide.

## Checklist por repo

- [ ] `node apply.mjs <repo>` exit 0
- [ ] Resultado JSON mostra `patchSlugRoute.ok = true`
- [ ] Build passou
- [ ] Diff revisado (1 import + 3 linhas no getStaticPaths)
- [ ] Commit + push

## Commit message sugerida

```
fix: condicionar [slug].astro raiz a postUrlPrefix

Evita duplicação de conteúdo quando aluno escolhe /blog/ prefix
no admin. Espelha a lógica já presente em /blog/[slug].astro.

via migration-kit/2026-05-26-url-prefix-fix
```

## Rollback

```bash
git revert <commit>
git push
```
