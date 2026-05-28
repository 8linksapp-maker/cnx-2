# Migration Kit — Categories Schema {name, slug}

**Data:** 2026-05-26
**Aplicável a:** sites MSIA com `src/data/categories.json` ainda como `string[]`
**Risco:** baixo-médio (mexe em editor + endpoint, mas é additive na maioria)
**Idempotente:** sim

---

## Contexto

Mass-fix #19 do log do Juvenal. O schema antigo era `["Categoria 1", "Categoria 2"]` — slug sempre derivado do nome. Aluno não conseguia customizar (ex.: chamar "Segurança Digital" mas que o slug fosse `ciber` em vez de `seguranca-digital`).

Esta migration introduz schema canônico `[{name, slug, description?}]` com helpers em `src/lib/categorySlug.ts` + UI atualizada no admin.

## O que acontece

| Ação | Arquivo |
|---|---|
| Migra schema | `src/data/categories.json` (string[] → {name,slug}[]) |
| Cria helper | `src/lib/categorySlug.ts` |
| Cria helper | `src/lib/vercelJson.ts` |
| Substitui editor | `src/components/admin/CategoriesEditor.tsx` |
| Substitui endpoint | `src/pages/api/admin/categories/rename.ts` |
| Cria página | `src/pages/categoria/[slug].astro` |
| Remove legado | `src/pages/categoria/[categoria].astro` |
| Roda build | bun / npm / yarn / pnpm |

## O que **NÃO** acontece (intencional)

O script **não** refatora os `cat.toLowerCase().replace(/[^a-z0-9]/g, '-')` inline em:
- `src/components/layout/Header.astro`
- `src/components/layout/Footer.astro`
- `src/components/sidebar/Sidebar.astro` (ou variante por template)
- `src/components/Sidebar.astro` (variante walker)
- `src/plugins/seo/SchemaMarkup.astro`
- `src/plugins/related-posts/RelatedPosts.astro`
- `src/components/sections/Section4Categories.astro`
- `src/pages/blog/[slug].astro`
- `src/pages/[slug].astro`

Razão: cada template (walker, techmaster, autoreview, clickbanker) tem layout próprio com esses inline replaces em lugares diferentes. Patch automatizado teria alta taxa de breakage. **Quando aluno customiza um slug** (ex.: `ciber` em vez de `seguranca-digital`), os links inline ficam apontando pra `/categoria/seguranca-digital` (404 ou redirect 301 — depende de `redirects.json`).

Pra zerar essa dívida no template do aluno, abrir tarefa específica por template no log de mass-fix.

## Uso

```bash
node apply.mjs <caminhoDoRepoClonado>
```

Stdout = JSON estruturado. Stderr = log line-by-line.

**Exit codes:**
- `0` — sucesso (migrado OU já estava aplicado)
- `1` — falha (path missing, JSON inválido, build quebrou) — ver JSON em stdout
- `2` — uso incorreto

Não commita. Quem chama decide o commit.

## Checklist por repo

- [ ] `node apply.mjs <repo>` exit 0
- [ ] `steps.migrateJson.status` = `migrated` ou `already-migrated`
- [ ] `steps.copyFiles` OK
- [ ] `steps.build.ok` = true
- [ ] Diff revisado:
  - [ ] categories.json com novo schema
  - [ ] 2 helpers novos em src/lib/
  - [ ] CategoriesEditor + rename.ts atualizados
  - [ ] [slug].astro criado, [categoria].astro removido
- [ ] Commit + push
- [ ] Post-deploy: `/categoria/<slug>` retorna 200 (após login no admin)

## Commit message sugerida

```
feat(categories): schema {name,slug} canônico + helper categorySlug.ts

- Migra src/data/categories.json de string[] pra [{name,slug,description?}]
- src/lib/categorySlug.ts: normalize, slugify, getSlug, getName, matches
- src/lib/vercelJson.ts: extraído de plugins/redirects pra reuso
- CategoriesEditor admin: 2 campos (name autoslug + slug editável) + colisão
- rename.ts: suporta newSlug no body + preserva slug existente como old
- categoria/[slug].astro: matching flexível (name|slug|slugify) + órfãos

via migration-kit/2026-05-26-categories-schema
```

## Rollback

```bash
git revert <commit>
git push
```

Sem schema migration de banco, sem mutação irreversível — rollback é limpo.

## Caveat

Se aluno tinha categoria com nome custom diferente do slug derivado **e** o slug derivado coincide com outra categoria, a migração detecta colisão e descarta a segunda. Verificar `steps.migrateJson.count` antes/depois pra confirmar que nenhum item foi perdido.
