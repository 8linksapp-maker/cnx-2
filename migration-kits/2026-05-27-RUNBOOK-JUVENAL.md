# Runbook — Mass-fix 2026-05-27 (4 kits sequenciais)

**Pra:** Juvenal (mass-fix runner via Python + Supabase + GitHub Contents API)
**Data:** 2026-05-27
**Autor:** Bruno + assistant

---

## TL;DR

Aplicar **4 migration kits** sequencialmente em todos os repos de aluno baseados em scaffold MSIA. Tudo via PUT/PATCH na GitHub Contents API usando `profiles.github_token` do aluno. Sem clone local.

| Ordem | Kit | Path no scaffold | Risco | Templates |
|---|---|---|---|---|
| 1 | **url-prefix-fix** | `migration-kits/2026-05-26-url-prefix-fix/` | baixo | Walker, TM, ClickBanker |
| 2 | **categories-schema** | `migration-kits/2026-05-26-categories-schema/` | médio | Walker, TM, ClickBanker |
| 3 | **backup-feature** | `migration-kits/2026-05-26-backup-feature/` | médio | Todos |
| 4 | **video-support** | `migration-kits/2026-05-27-video-support/` | baixo | Todos |

Total: ~25 calls HTTP por repo. Pool de 5 → ~5min pra ~70 alunos.

---

## Pré-reqs

```python
import os, json, base64, urllib.request, urllib.parse

SUPA_URL = "https://meusitecomia.8links.app"
SUPA_KEY = os.environ["SUPABASE_SERVICE_KEY"]  # service_role, RLS bypass

# Headers padrão Supabase
SUPA_HDR = {
    "apikey": SUPA_KEY,
    "Authorization": f"Bearer {SUPA_KEY}",
    "Content-Type": "application/json",
}

# Headers GitHub (token por aluno)
def gh_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }
```

## Query Supabase pra pegar sites + tokens

```python
def fetch_sites_with_tokens(template_ids: list[str] | None = None) -> list[dict]:
    """Retorna [{github_owner, github_repo, vercel_project_id, token, user_id, template_id}]"""
    filt = ""
    if template_ids:
        ids_csv = ",".join(template_ids)
        filt = f"&template_id=in.({ids_csv})"
    sites_url = f"{SUPA_URL}/rest/v1/user_sites?select=user_id,github_owner,github_repo,vercel_project_id,template_id&inactive=eq.false{filt}"
    req = urllib.request.Request(sites_url, headers=SUPA_HDR)
    sites = json.loads(urllib.request.urlopen(req).read())

    if not sites:
        return []

    uids = list({s["user_id"] for s in sites})
    profs_url = f"{SUPA_URL}/rest/v1/profiles?id=in.({','.join(uids)})&select=id,github_token"
    req = urllib.request.Request(profs_url, headers=SUPA_HDR)
    profs = json.loads(urllib.request.urlopen(req).read())
    tok = {p["id"]: p.get("github_token") for p in profs}

    out = []
    for s in sites:
        t = tok.get(s["user_id"])
        if not t:
            continue
        out.append({**s, "token": t})
    return out
```

## Template IDs

| Template | template_id |
|---|---|
| Walker | `1ba0f64d-ce0c-4ca1-a2f4-e69e3e03d8aa` |
| TechMaster | `1df41302-6359-4609-bfa1-2f41f54fd740` |
| AutoReview | `0da2f9da-adf7-47fd-8bc4-021127eb3ae2` |
| ClickBanker | _(novo — descobrir no Supabase quando primeiro aluno comprar)_ |

Repos órfãos esperados (skip silenciosamente):
- `kalvesdropservice-code/gerador-br`
- `kalvesdropservice-code/o-especialista-do-colchao`
- `leandro41009-spec/guiamelhorescaiaques-com-br`

## Helpers GitHub Contents API

```python
def gh_get(repo: str, path: str, token: str) -> tuple[str | None, str | None]:
    """Retorna (content_decoded, sha) ou (None, None) se 404."""
    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    req = urllib.request.Request(url, headers=gh_headers(token))
    try:
        r = urllib.request.urlopen(req)
        d = json.loads(r.read())
        if d.get("content"):
            return base64.b64decode(d["content"]).decode("utf-8"), d["sha"]
        return None, d.get("sha")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None, None
        raise

def gh_put(repo: str, path: str, content: str | bytes, message: str, token: str, sha: str | None = None) -> bool:
    """PUT arquivo. Se sha=None, faz lookup automático antes."""
    if sha is None:
        _, sha = gh_get(repo, path, token)
    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    raw = content.encode("utf-8") if isinstance(content, str) else content
    body = {
        "message": message,
        "content": base64.b64encode(raw).decode("ascii"),
    }
    if sha:
        body["sha"] = sha
    req = urllib.request.Request(url, method="PUT", headers={**gh_headers(token), "Content-Type": "application/json"}, data=json.dumps(body).encode())
    try:
        urllib.request.urlopen(req)
        return True
    except urllib.error.HTTPError as e:
        print(f"PUT failed {repo}/{path}: {e.code} {e.read()[:200]}")
        return False

def gh_delete(repo: str, path: str, message: str, token: str) -> bool:
    _, sha = gh_get(repo, path, token)
    if not sha:
        return True  # já não existe
    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    body = {"message": message, "sha": sha}
    req = urllib.request.Request(url, method="DELETE", headers={**gh_headers(token), "Content-Type": "application/json"}, data=json.dumps(body).encode())
    try:
        urllib.request.urlopen(req)
        return True
    except urllib.error.HTTPError as e:
        print(f"DELETE failed {repo}/{path}: {e.code}")
        return False
```

## Fonte de verdade dos arquivos do kit

GitHub raw, via:
```
https://raw.githubusercontent.com/8linksapp-maker/msia-scaffold/main/migration-kits/<kit-id>/files/<filename>
```

Helper:
```python
SCAFFOLD_RAW = "https://raw.githubusercontent.com/8linksapp-maker/msia-scaffold/main/migration-kits"

def fetch_kit_file(kit_id: str, filename: str) -> str:
    url = f"{SCAFFOLD_RAW}/{kit_id}/files/{filename}"
    return urllib.request.urlopen(url).read().decode("utf-8")
```

---

# Kit 1: url-prefix-fix

## O que faz
Fix do bug: `src/pages/[slug].astro` raiz sempre gerava posts, mesmo com `postUrlPrefix=blog`, duplicando conteúdo SEO.

## Operações

**Patch em `src/pages/[slug].astro`** — adicionar condicional + import.

### Detecção de idempotência
```python
content = gh_get(repo, "src/pages/[slug].astro", token)[0]
if not content:
    return {"status": "missing-file", "skip": True}
if "postUrlPrefix === 'blog'" in content and "return []" in content:
    return {"status": "already-applied"}
```

### Patch
Regex pra achar o getStaticPaths atual:
```python
import re
re_static = re.compile(
    r"(export\s+async\s+function\s+getStaticPaths\s*\(\)\s*\{)(\s*)const\s+posts\s*=\s*await\s+getCollection\(['\"]blog['\"]\)",
    re.MULTILINE
)
m = re_static.search(content)
if not m:
    return {"status": "no-match", "skip": True}

# Garantir import de readData
patched = content
if not re.search(r"import\s*\{[^}]*\breadData\b[^}]*\}\s*from", content, re.DOTALL):
    # Adicionar import após o último import existente
    last_import = list(re.finditer(r"^import[^\n]+\n", content, re.MULTILINE))
    if last_import:
        idx = last_import[-1].end()
        patched = content[:idx] + "import { readData } from '../lib/readData';\n" + content[idx:]

# Aplicar o patch principal
new_body = (
    r"\1\2const siteConfig = readData('siteConfig.json', {}) as any;\n"
    r"  // Quando aluno escolheu prefixo /blog, esta rota nao gera (evita duplicacao com /blog/[slug]).\n"
    r"  if (siteConfig?.postUrlPrefix === 'blog') return [];\n"
    r"  const posts = await getCollection('blog')"
)
patched = re_static.sub(new_body, patched)
```

### Commit
```python
gh_put(repo, "src/pages/[slug].astro", patched,
       "fix(seo): condicionar [slug].astro raiz a postUrlPrefix (evita duplicacao)",
       token)
```

---

# Kit 2: categories-schema

## O que faz
Migra `categories.json` de `string[]` pra `[{name, slug, description?}]` + cria helpers + atualiza editor + página de categoria + endpoint de rename.

## Operações em ordem

### 1. Migra `src/data/categories.json`

```python
content, sha = gh_get(repo, "src/data/categories.json", token)
if content:
    try:
        parsed = json.loads(content)
    except:
        return {"status": "invalid-json", "skip": True}
    if isinstance(parsed, list) and len(parsed) > 0:
        if isinstance(parsed[0], dict) and "slug" in parsed[0]:
            pass  # já migrado
        elif isinstance(parsed[0], str):
            ACCENT_MAP = {
                'á':'a','à':'a','ã':'a','â':'a','ä':'a','é':'e','è':'e','ê':'e','ë':'e',
                'í':'i','ì':'i','î':'i','ï':'i','ó':'o','ò':'o','õ':'o','ô':'o','ö':'o',
                'ú':'u','ù':'u','û':'u','ü':'u','ç':'c','ñ':'n',
                'Á':'a','À':'a','Ã':'a','Â':'a','Ä':'a','É':'e','È':'e','Ê':'e','Ë':'e',
                'Í':'i','Ì':'i','Î':'i','Ï':'i','Ó':'o','Ò':'o','Õ':'o','Ô':'o','Ö':'o',
                'Ú':'u','Ù':'u','Û':'u','Ü':'u','Ç':'c','Ñ':'n',
            }
            def slugify(s: str) -> str:
                out = "".join(ACCENT_MAP.get(c, c) for c in s)
                return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", out.lower())).strip("-")
            seen = set()
            migrated = []
            for item in parsed:
                if not isinstance(item, str) or not item.strip():
                    continue
                name = item.strip()
                slug = slugify(name)
                if slug in seen:
                    continue
                seen.add(slug)
                migrated.append({"name": name, "slug": slug})
            gh_put(repo, "src/data/categories.json", json.dumps(migrated, indent=2, ensure_ascii=False),
                   "feat(categories): migra schema string[] -> [{name,slug}]",
                   token, sha=sha)
```

### 2. PUTs (arquivos novos/sobrescrever)

Arquivos no scaffold em `migration-kits/2026-05-26-categories-schema/files/`:

| Source no kit | Destino no repo do aluno | Overwrite se diferir? |
|---|---|---|
| `categorySlug.ts` | `src/lib/categorySlug.ts` | Não — só cria se ausente |
| `vercelJson.ts` | `src/lib/vercelJson.ts` | Não — só cria se ausente |
| `CategoriesEditor.tsx` | `src/components/admin/CategoriesEditor.tsx` | **Sim** — sobrescreve |
| `rename.ts` | `src/pages/api/admin/categories/rename.ts` | **Sim** — sobrescreve |
| `categoria-slug.astro` | `src/pages/categoria/[slug].astro` | **Sim** — sobrescreve |

```python
SAFE_NEW = ["src/lib/categorySlug.ts", "src/lib/vercelJson.ts"]
OVERWRITE = [
    "src/components/admin/CategoriesEditor.tsx",
    "src/pages/api/admin/categories/rename.ts",
    "src/pages/categoria/[slug].astro",
]
kit_id = "2026-05-26-categories-schema"
src_map = {
    "src/lib/categorySlug.ts": "categorySlug.ts",
    "src/lib/vercelJson.ts": "vercelJson.ts",
    "src/components/admin/CategoriesEditor.tsx": "CategoriesEditor.tsx",
    "src/pages/api/admin/categories/rename.ts": "rename.ts",
    "src/pages/categoria/[slug].astro": "categoria-slug.astro",
}

for dst, src_name in src_map.items():
    new_content = fetch_kit_file(kit_id, src_name)
    existing, sha = gh_get(repo, dst, token)
    if dst in SAFE_NEW and existing is not None and existing != new_content:
        continue  # tem versão divergente, não sobrescreve
    if existing == new_content:
        continue  # idempotente
    gh_put(repo, dst, new_content, f"feat(categories): {dst}", token, sha=sha)
```

### 3. DELETE legado

```python
gh_delete(repo, "src/pages/categoria/[categoria].astro",
          "feat(categories): remove rota legada [categoria].astro",
          token)
```

---

# Kit 3: backup-feature

## O que faz
Cria `/admin/backup` com export/import de posts em `.zip`. 5 arquivos novos + 2 patches no AdminNav + dep `jszip`.

## Operações em ordem

### 1. PUTs (5 arquivos novos)

Arquivos no scaffold em `migration-kits/2026-05-26-backup-feature/files/`:

| Source | Destino |
|---|---|
| `repoIo.ts` | `src/lib/repoIo.ts` |
| `export.ts` | `src/pages/api/admin/export.ts` |
| `import.ts` | `src/pages/api/admin/import.ts` |
| `BackupManager.tsx` | `src/components/admin/BackupManager.tsx` |
| `backup.astro` | `src/pages/admin/backup.astro` |

Pra cada um: GET → se idêntico, skip. Se ausente, PUT. Se divergente, **abortar o repo** e logar (não sobrescrever).

### 2. Patch em `src/components/admin/AdminNav.tsx`

**Patch A** — adicionar `FileArchive` no import lucide-react:
```python
nav_content, nav_sha = gh_get(repo, "src/components/admin/AdminNav.tsx", token)
if "FileArchive" not in nav_content:
    # Procura import block do lucide-react
    re_import = re.compile(
        r"(import\s*\{)([^}]+)(\}\s*from\s*['\"]lucide-react['\"])",
        re.DOTALL
    )
    m = re_import.search(nav_content)
    if m:
        inner = m.group(2).rstrip().rstrip(",")
        new_inner = inner + ", FileArchive,"
        nav_content = re_import.sub(rf"\1{new_inner}\3", nav_content)
```

**Patch B** — adicionar `<NavLink>` Backup após Configurações:
```python
if "href: '/admin/backup'" not in nav_content:
    re_config = re.compile(
        r"(<NavLink\s+item=\{\{\s*label:\s*'Configurações',\s*href:\s*'/admin/config',\s*icon:\s*Settings,\s*section:\s*'config'\s*\}\}\s+active=\{activeSection\s*===\s*'config'\}\s*/>)"
    )
    inj = "\n                    <NavLink item={{ label: 'Backup', href: '/admin/backup', icon: FileArchive, section: 'backup' }} active={activeSection === 'backup'} />"
    nav_content = re_config.sub(r"\1" + inj, nav_content)
```

Commitar AdminNav se alterado:
```python
gh_put(repo, "src/components/admin/AdminNav.tsx", nav_content,
       "feat(backup): add FileArchive import + Backup NavLink", token, sha=nav_sha)
```

### 3. Patch em `package.json` + delete lockfile

```python
pkg_content, pkg_sha = gh_get(repo, "package.json", token)
pkg = json.loads(pkg_content)
deps = pkg.setdefault("dependencies", {})
if "jszip" not in deps:
    deps["jszip"] = "^3.10.1"
    new_pkg = json.dumps(pkg, indent=2) + "\n"
    gh_put(repo, "package.json", new_pkg,
           "feat(backup): add jszip dependency", token, sha=pkg_sha)

# Deletar lockfile pra Vercel re-resolver
for lockfile in ["bun.lockb", "bun.lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"]:
    gh_delete(repo, lockfile, f"chore: regenerate lockfile after dep change", token)
```

⚠️ **Atenção:** o delete do lockfile força Vercel a re-instalar com o resolver default. Se aluno tinha pinning específico de outra dep, **vai re-resolver** (pode mudar minor versions). Risco aceitável dado que apenas adicionamos jszip — todos os outros pacotes mantêm range no package.json.

---

# Kit 4: video-support

## O que faz
Suporte estrutural a vídeos via frontmatter `videoUrl` + shortcode `[[video:URL]]`.

## Operações

### 1. PUTs (3 arquivos novos)

Arquivos no scaffold em `migration-kits/2026-05-27-video-support/files/`:

| Source | Destino | Overwrite? |
|---|---|---|
| `videoEmbed.ts` | `src/lib/videoEmbed.ts` | Sim (se idêntico, skip) |
| `PostVideo.astro` | `src/components/ui/PostVideo.astro` | Sim (se idêntico, skip) |
| `shortcodes-minimal.ts` | `src/lib/shortcodes.ts` | **NÃO** — só cria se ausente |

```python
kit_id = "2026-05-27-video-support"

# videoEmbed.ts + PostVideo.astro: sobrescrever só se idêntico não, mas reaplicar mais recente
for dst, src in [
    ("src/lib/videoEmbed.ts", "videoEmbed.ts"),
    ("src/components/ui/PostVideo.astro", "PostVideo.astro"),
]:
    new_c = fetch_kit_file(kit_id, src)
    cur, sha = gh_get(repo, dst, token)
    if cur == new_c:
        continue
    if cur is not None:
        # Já existe com conteúdo diferente — overwrite (é arquivo "nosso")
        gh_put(repo, dst, new_c, f"feat(video): update {dst}", token, sha=sha)
    else:
        gh_put(repo, dst, new_c, f"feat(video): add {dst}", token)

# shortcodes.ts: só cria se ausente
shortcodes_cur, sc_sha = gh_get(repo, "src/lib/shortcodes.ts", token)
if shortcodes_cur is None:
    new_c = fetch_kit_file(kit_id, "shortcodes-minimal.ts")
    gh_put(repo, "src/lib/shortcodes.ts", new_c,
           "feat(video): add shortcodes lib (minimal)", token)
elif "VIDEO_RE" not in shortcodes_cur and "[[video:" not in shortcodes_cur:
    # Existe sem suporte a video — NÃO sobrescreve, mas LOGA pra manual review
    return {"status": "shortcodes-manual-merge-required"}
```

### 2. Patch em `src/content/config.ts` (Zod schema)

```python
cfg_content, cfg_sha = gh_get(repo, "src/content/config.ts", token)
if "videoUrl" in cfg_content and "videoPosition" in cfg_content:
    pass  # já patcheado
else:
    re_schema = re.compile(
        r"(schema\s*:\s*z\.object\(\{[\s\S]*?)(\n\s*\}\),?\s*\n\s*\}\))",
    )
    m = re_schema.search(cfg_content)
    if m:
        inject = (
            "\n        /** URL de vídeo a embedar no post (YouTube, Vimeo, iframe). */\n"
            "        videoUrl: z.string().optional(),\n"
            "        /** Posição: 'hero' | 'after-hero' (default) | 'inline'. */\n"
            "        videoPosition: z.enum(['hero', 'after-hero', 'inline']).optional(),"
        )
        cfg_content = re_schema.sub(rf"\1{inject}\2", cfg_content)
        gh_put(repo, "src/content/config.ts", cfg_content,
               "feat(video): add videoUrl + videoPosition to schema",
               token, sha=cfg_sha)
```

### 3. Manual steps (NÃO automatizar)

Page renderers (`pages/[slug].astro` + `pages/blog/[slug].astro`) e `PostEditor.tsx` variam **muito** entre templates. Loga como `manual_steps` no JSON de output e Bruno revisa depois.

Caminho mínimo viável: aluno digita `[[video:URL]]` no Quill — funciona out of the box se `shortcodes.ts` existir + page renderer já chama `renderShortcodes`. Detecta isso:

```python
def detect_shortcode_render(repo: str, token: str) -> dict:
    results = {}
    for p in ["src/pages/[slug].astro", "src/pages/blog/[slug].astro"]:
        c, _ = gh_get(repo, p, token)
        if c is None:
            results[p] = "not-found"
        elif "renderShortcodes" in c:
            results[p] = "has-shortcodes"
        elif "<Content" in c:
            results[p] = "plain-content"
        else:
            results[p] = "unknown"
    return results
```

---

# Deploy hook (após cada repo)

Todos os repos têm `vercel.json` com `git.deploymentEnabled.main: false` — commits via API **não disparam deploy automático**. Tem que chamar deploy hook.

```python
def trigger_vercel_deploy(vercel_project_id: str, vc_token: str) -> bool:
    """Pega o primeiro deploy hook do projeto e dispara."""
    hooks_url = f"https://api.vercel.com/v1/projects/{vercel_project_id}/deploy-hooks"
    req = urllib.request.Request(hooks_url, headers={"Authorization": f"Bearer {vc_token}"})
    hooks = json.loads(urllib.request.urlopen(req).read())
    if not hooks:
        return False
    hook_url = f"https://api.vercel.com/v1/integrations/deploy/{vercel_project_id}/{hooks[0]['id']}"
    req = urllib.request.Request(hook_url, method="POST")
    urllib.request.urlopen(req)
    return True
```

⚠️ Só dispara deploy se **todos os 4 kits** retornaram sucesso. Se houver `manual_steps` ou erro, **não** dispara — fica pra rodada manual depois.

---

# Loop principal

```python
def run_mass_fix(template_ids: list[str] | None = None, dry_run: bool = False):
    sites = fetch_sites_with_tokens(template_ids)
    results = []
    for site in sites:
        repo = f"{site['github_owner']}/{site['github_repo']}"
        token = site["token"]
        site_result = {"repo": repo, "kits": {}}
        try:
            site_result["kits"]["url_prefix_fix"] = apply_url_prefix_fix(repo, token, dry_run)
            site_result["kits"]["categories_schema"] = apply_categories_schema(repo, token, dry_run)
            site_result["kits"]["backup_feature"] = apply_backup_feature(repo, token, dry_run)
            site_result["kits"]["video_support"] = apply_video_support(repo, token, dry_run)
            site_result["success"] = all(
                k.get("success", True) for k in site_result["kits"].values()
            )
            if site_result["success"] and not dry_run:
                # Deploy
                if site.get("vercel_project_id"):
                    trigger_vercel_deploy(site["vercel_project_id"], os.environ["VERCEL_TOKEN"])
        except Exception as e:
            site_result["error"] = str(e)
            site_result["success"] = False
        results.append(site_result)
        print(json.dumps(site_result))
    return results
```

---

# Logging recomendado

Append-only JSONL em `runs/2026-05-27.jsonl`. Uma linha por site. Estrutura:

```json
{"ts":"...","repo":"owner/name","kits":{"url_prefix_fix":{...},"categories_schema":{...},"backup_feature":{...},"video_support":{...}},"success":true,"deploy_triggered":true}
```

Após o run, agregar em sumário:
- Total: X repos
- Success completo: X
- Manual steps pendentes (por kit): X, Y, Z
- Erros: X (lista os repos)

Esses dados depois vão pra entrada nova no `mass-fixes/log.md` do Juvenal.

---

# Checklist pre-flight

Antes de rodar em prod:

- [ ] `SUPABASE_SERVICE_KEY` no env
- [ ] `VERCEL_TOKEN` no env (admin token da team Pro)
- [ ] Dry-run em 1 repo de cada template (Walker, TM, AR, ClickBanker)
- [ ] Confirmar que `8linksapp-maker/msia-scaffold/main/migration-kits/` tem os 4 kits acessíveis (raw URLs)
- [ ] Backup do `mass-fixes/log.md` antes de rodar
- [ ] Confirmar que os 3 repos órfãos conhecidos vão dar 404 e ser skipados (não abortar o loop)

# Edge cases conhecidos

1. **`bun.lockb` pode ser binário** — `gh_get` decodifica como utf-8 e quebra. Solução: pular o decode do conteúdo no DELETE (só precisa do sha).

2. **AdminNav.tsx customizado** (aluno modificou layout) — regex pode não casar com o NavLink de Configurações. Fallback: se patch B falhar, loga manual step e segue.

3. **categories.json com mojibake** (chars `Ã§`, `Ã£`) — o slugify Python deve normalizar via NFD primeiro:
```python
import unicodedata
def slugify(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii','ignore').decode('ascii')
    return re.sub(r"-+","-", re.sub(r"[^a-z0-9]+","-", s.lower())).strip("-")
```

4. **Walker e TechMaster têm `cat.toLowerCase().replace(/[^a-z0-9]/g,'-')` inline em Header/Footer/Sidebar** — não automatizar fix disso, segue como manual step do kit categories-schema (slug auto-derivado continua funcionando como fallback até aluno customizar slug).

5. **Rate limit GitHub**: cada aluno tem 5000/h via seu token. Como cada repo usa próprio token, sem cruzamento. Pool de 5 é seguro.

---

# Após o run

1. Append entrada nova em `mass-fixes/log.md`:
   ```
   ## #20 — Mass-fix sequencial 2026-05-27 (4 kits)
   ...
   ```
2. Commitar log
3. Comunicar Bruno: stats de sucesso + lista de `manual_steps` pendentes
