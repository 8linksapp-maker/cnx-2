# CMS Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir todos os 21 gaps identificados na auditoria técnica do msia-scaffold (2 P0, 7 P1, 12 P2) em 3 batches independentes.

**Architecture:** 3 batches independentes — P0 (race conditions + log rotation), P1 (segurança + auth + operacional), P2 (melhorias + plugin slots condicionais). Cada batch produz commits separados. Sem deps externas novas. Sem test runner — verificação via `bun run build`.

**Tech Stack:** Astro 5.1 SSG, TypeScript, Vercel serverless (Node.js 22), GitHub Contents API + Tree API, Web Crypto API (HMAC-SHA256).

---

> ⚠️ **URGENTE — ANTES DE QUALQUER TASK:** `src/data/pluginsConfig.json` contém uma chave OpenAI real na linha 52. Revogar IMEDIATAMENTE em https://platform.openai.com/api-keys e limpar o campo `"apiKey": ""` antes de qualquer commit. Essa chave não deve nunca ser commitada.

---

## File Map

### Novos
- `src/lib/repoAtomicCommit.ts` — GitHub Tree API: commits atômicos com múltiplos arquivos
- `src/lib/emailLog.ts` — log de emails com rotação automática quando >400KB

### Modificados — Batch 1 (P0)
- `src/pages/api/admin/categories/rename.ts` — usa atomicCommit em vez de N writes
- `src/pages/api/cron/process-sequences.ts` — usa emailLog em vez de write direto
- `src/plugins/_server.ts` — usa emailLog para append

### Modificados — Batch 2 (P1)
- `src/lib/auth.ts` — timingSafeEqual + signAttempts/readAttempts
- `src/pages/api/admin/login.ts` — flag Secure + brute force via cookie assinado
- `src/lib/repoIo.ts` — retry exponencial em 409 + aviso >900KB
- `src/plugins/_server.ts` — retry exponencial em writeFileToRepo
- `src/pages/api/admin/plugins/email-list/send-email.ts` — rate limit via emailLog
- `src/pages/api/admin/import.ts` — MAX_ZIP_SIZE 10MB + atomicCommit em apply mode
- `vercel.json` — maxDuration/memory para import endpoint
- `src/pages/api/admin/plugins/search-console/data.ts` — lê env var
- `src/data/pluginsConfig.json` — remove serviceAccountJson

### Modificados — Batch 3 (P2)
- `src/middleware.ts` — parse de cookie robusto
- `src/lib/repoIo.ts` — invalida cache após write
- `src/pages/api/admin/import.ts` — regex filename mais estrita
- `src/data/subscribers.json` — campo unsubscribedAt no schema
- `src/pages/api/cron/process-sequences.ts` — escapeHtml + filtro unsubscribed
- `src/pages/api/admin/plugins/ai/generate.ts` — AbortController 60s
- `src/pages/api/admin/deploy-status.ts` — cache 30s + timeout 5s
- `src/pages/api/admin/plugins/email-list/send-email.ts` — remove validateSession duplo
- `src/pages/api/admin/plugins/email-list/leads.ts` — remove validateSession duplo
- `src/pages/api/admin/plugins/ai/generate.ts` — remove validateSession duplo
- `src/pages/api/admin/plugins/search-console/data.ts` — remove validateSession duplo
- `src/plugins/_slots/HeadPlugins.astro` — renderização condicional
- `src/plugins/_slots/BodyEndPlugins.astro` — renderização condicional
- `src/plugins/_slots/PostAfterPlugins.astro` — renderização condicional
- `src/plugins/_slots/BodyStartPlugins.astro` — novo (GTM noscript)

---

## BATCH 1 — P0: Race Conditions + Email Log

---

### Task 1: Criar `src/lib/repoAtomicCommit.ts`

**Files:**
- Create: `src/lib/repoAtomicCommit.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
/**
 * repoAtomicCommit.ts — Commit atômico via GitHub Git Tree API.
 * Um único commit agrupa N alterações de arquivo.
 * Em dev (sem GITHUB_TOKEN), faz writes individuais no filesystem.
 */
import fs from 'node:fs/promises';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = nodePath.resolve(fileURLToPath(import.meta.url), '../../../');

export interface AtomicFile {
  /** Caminho relativo à raiz do repo, ex: "src/data/categories.json" */
  path: string;
  /** Conteúdo em texto (UTF-8). Null remove o arquivo. */
  content: string | null;
}

function ghEnv() {
  const token = import.meta.env.GITHUB_TOKEN;
  const owner = import.meta.env.GITHUB_OWNER;
  const repo = import.meta.env.GITHUB_REPO;
  if (!token || !owner || !repo) return null;
  return { token, owner, repo,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' } };
}

async function ghFetch(url: string, env: ReturnType<typeof ghEnv>, opts: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...opts, headers: { ...env!.headers, ...(opts.headers as any || {}) } });
}

/**
 * Commita múltiplos arquivos de uma vez (atômico).
 * Falha completamente ou tem sucesso completamente — sem estado intermediário.
 */
export async function atomicCommit(files: AtomicFile[], message: string): Promise<void> {
  const env = ghEnv();

  // Dev mode: writes individuais no filesystem
  if (!env) {
    for (const f of files) {
      const abs = nodePath.join(PROJECT_ROOT, f.path);
      if (f.content === null) {
        await fs.rm(abs, { force: true });
      } else {
        await fs.mkdir(nodePath.dirname(abs), { recursive: true });
        await fs.writeFile(abs, f.content, 'utf-8');
      }
    }
    return;
  }

  const base = `https://api.github.com/repos/${env.owner}/${env.repo}`;

  // 1. SHA do commit HEAD de main
  const refRes = await ghFetch(`${base}/git/ref/heads/main`, env);
  if (!refRes.ok) throw new Error(`Falha ao buscar HEAD: ${refRes.status}`);
  const refData = await refRes.json();
  const headCommitSha: string = refData.object.sha;

  // 2. SHA da tree base
  const commitRes = await ghFetch(`${base}/git/commits/${headCommitSha}`, env);
  if (!commitRes.ok) throw new Error(`Falha ao buscar commit base: ${commitRes.status}`);
  const commitData = await commitRes.json();
  const baseTreeSha: string = commitData.tree.sha;

  // 3. Monta tree com todos os arquivos
  const treeItems = files.map(f => {
    if (f.content === null) {
      return { path: f.path, mode: '100644' as const, type: 'blob' as const, sha: null };
    }
    return { path: f.path, mode: '100644' as const, type: 'blob' as const, content: f.content };
  });

  const treeRes = await ghFetch(`${base}/git/trees`, env, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
  });
  if (!treeRes.ok) {
    const e = await treeRes.json().catch(() => ({}));
    throw new Error(`Falha ao criar tree: ${e.message || treeRes.status}`);
  }
  const treeData = await treeRes.json();
  const newTreeSha: string = treeData.sha;

  // 4. Cria o commit
  const newCommitRes = await ghFetch(`${base}/git/commits`, env, {
    method: 'POST',
    body: JSON.stringify({ message, tree: newTreeSha, parents: [headCommitSha] }),
  });
  if (!newCommitRes.ok) {
    const e = await newCommitRes.json().catch(() => ({}));
    throw new Error(`Falha ao criar commit: ${e.message || newCommitRes.status}`);
  }
  const newCommitData = await newCommitRes.json();
  const newCommitSha: string = newCommitData.sha;

  // 5. Atualiza ref main
  const updateRes = await ghFetch(`${base}/git/refs/heads/main`, env, {
    method: 'PATCH',
    body: JSON.stringify({ sha: newCommitSha }),
  });
  if (!updateRes.ok) {
    const e = await updateRes.json().catch(() => ({}));
    throw new Error(`Falha ao atualizar ref: ${e.message || updateRes.status}`);
  }
}
```

- [ ] **Step 2: Verificar build**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -20
```

Esperado: build sem erros de TypeScript relacionados ao novo arquivo.

- [ ] **Step 3: Commit**

```bash
cd C:\Projects\msia-scaffold
git add src/lib/repoAtomicCommit.ts
git commit -m "feat(p0): repoAtomicCommit — GitHub Tree API para commits atômicos"
```

---

### Task 2: Refatorar `categories/rename.ts` para commit atômico

**Files:**
- Modify: `src/pages/api/admin/categories/rename.ts`

- [ ] **Step 1: Substituir os N writes por um atomicCommit**

Reescrever o arquivo inteiro. O novo arquivo monta todos os arquivos alterados em memória e faz 1 chamada `atomicCommit` no final:

```typescript
/**
 * API Route: /api/admin/categories/rename
 * POST { oldName, newName, newSlug?, description?, createRedirect? }
 *
 * Usa atomicCommit para garantir que todos os arquivos (categories.json,
 * posts afetados, redirects.json, vercel.json) sejam atualizados em 1 commit.
 */
import type { APIRoute } from 'astro';
import { readFileFromRepo } from '../../../../plugins/_server';
import { normalizeCategories, slugifyCategory, type CategoryEntry } from '../../../../lib/categorySlug';
import { buildVercelRedirects } from '../../../../lib/vercelJson';
import { atomicCommit, type AtomicFile } from '../../../../lib/repoAtomicCommit';

export const prerender = false;

const CATEGORIES_PATH = 'src/data/categories.json';
const REDIRECTS_PATH = 'src/data/redirects.json';
const VERCEL_JSON_PATH = 'vercel.json';
const BLOG_DIR = 'src/content/blog';
const slugify = slugifyCategory;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const oldName = String(body.oldName || '').trim();
    const newName = String(body.newName || '').trim();
    const newSlugRaw = String(body.newSlug || '').trim();
    const description = body.description ? String(body.description).trim() : undefined;
    const createRedirect = body.createRedirect !== false;

    if (!oldName || !newName) {
      return new Response(JSON.stringify({ error: 'oldName e newName são obrigatórios' }), { status: 400 });
    }

    // 1) Lê categories.json
    const catRaw = await readFileFromRepo(CATEGORIES_PATH);
    let parsedRaw: any = [];
    try { parsedRaw = JSON.parse(catRaw || '[]'); } catch {}
    const categories: CategoryEntry[] = normalizeCategories(parsedRaw);

    const idx = categories.findIndex(c => c.name === oldName || c.slug === oldName);
    if (idx === -1) {
      return new Response(JSON.stringify({ error: `Categoria "${oldName}" não existe` }), { status: 404 });
    }
    const oldEntry = categories[idx];
    const newSlug = newSlugRaw || slugify(newName);
    const collision = categories.find((c, i) => i !== idx && (c.name === newName || c.slug === newSlug));
    if (collision) {
      return new Response(JSON.stringify({ error: `Já existe categoria "${collision.name}" (slug: ${collision.slug})` }), { status: 409 });
    }
    if (oldEntry.name === newName && oldEntry.slug === newSlug && (oldEntry.description || '') === (description || '')) {
      return new Response(JSON.stringify({ success: true, postsUpdated: 0, redirectsCreated: 0, noop: true }), { status: 200 });
    }

    // Monta lista de arquivos a commitar
    const filesToCommit: AtomicFile[] = [];

    // categories.json atualizado
    categories[idx] = description
      ? { name: newName, slug: newSlug, description }
      : { name: newName, slug: newSlug };
    filesToCommit.push({ path: CATEGORIES_PATH, content: JSON.stringify(categories, null, 2) });

    // 2) Lista e atualiza posts afetados (leitura em paralelo)
    const token = import.meta.env.GITHUB_TOKEN || '';
    const owner = import.meta.env.GITHUB_OWNER || '';
    const repo = import.meta.env.GITHUB_REPO || '';

    let postsUpdated = 0;
    const escapedOld = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const oldQuoted = new RegExp(`^(\\s*category:\\s*)["']?${escapedOld}["']?(\\s*)$`, 'm');

    if (token && owner && repo) {
      const listRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${BLOG_DIR}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
      );
      const listed = listRes.ok ? await listRes.json() : [];

      // Lê todos os posts em paralelo
      const postFiles = Array.isArray(listed) ? listed.filter((f: any) => f.name?.endsWith('.md')) : [];
      const contents = await Promise.all(
        postFiles.map((f: any) => readFileFromRepo(f.path).then(c => ({ path: f.path, content: c })))
      );

      for (const { path, content } of contents) {
        if (!content || !oldQuoted.test(content)) continue;
        const updated = content.replace(oldQuoted, (_m, p1, p2) => `${p1}"${newName}"${p2}`);
        if (updated === content) continue;
        filesToCommit.push({ path, content: updated });
        postsUpdated++;
      }
    }

    // 3) Redirect 301
    let redirectsCreated = 0;
    if (createRedirect) {
      const oldSlug = oldEntry.slug || slugify(oldName);
      if (oldSlug && newSlug && oldSlug !== newSlug) {
        const redRaw = await readFileFromRepo(REDIRECTS_PATH);
        let redirects: any[] = [];
        try { redirects = JSON.parse(redRaw || '[]'); } catch {}
        if (!Array.isArray(redirects)) redirects = [];

        const from = `/categoria/${oldSlug}`;
        const to = `/categoria/${newSlug}`;
        if (!redirects.some(r => r.from === from)) {
          redirects.push({ id: `cat-rename-${Date.now()}`, from, to, type: 301, enabled: true, createdBy: 'category-rename' });
          filesToCommit.push({ path: REDIRECTS_PATH, content: JSON.stringify(redirects, null, 2) });

          // vercel.json com redirects
          const vercelRaw = await readFileFromRepo(VERCEL_JSON_PATH);
          let vercelConfig: any = {};
          try { if (vercelRaw) vercelConfig = JSON.parse(vercelRaw); } catch {}
          vercelConfig.redirects = buildVercelRedirects(redirects);
          filesToCommit.push({ path: VERCEL_JSON_PATH, content: JSON.stringify(vercelConfig, null, 2) });
          redirectsCreated = 1;
        }
      }
    }

    // 4) Um único commit atômico
    const commitMsg = `CMS: Renomeando categoria "${oldName}" → "${newName}" (${postsUpdated} posts, ${redirectsCreated} redirect)`;
    await atomicCommit(filesToCommit, commitMsg);

    return new Response(JSON.stringify({ success: true, postsUpdated, redirectsCreated }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'erro' }), { status: 500 });
  }
};
```

- [ ] **Step 2: Verificar build**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -20
```

Esperado: 0 erros de TypeScript.

- [ ] **Step 3: Commit**

```bash
cd C:\Projects\msia-scaffold
git add src/pages/api/admin/categories/rename.ts
git commit -m "fix(p0): category rename agora usa commit atômico (Git Tree API)"
```

---

### Task 3: Criar `src/lib/emailLog.ts`

**Files:**
- Create: `src/lib/emailLog.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
/**
 * emailLog.ts — Log de emails enviados com rotação automática.
 *
 * GitHub API tem limite de 1MB por arquivo via REST. Quando emailsSent.json
 * ultrapassa 400KB, o conteúdo é arquivado em emailsSent-YYYY-MM.json e o
 * arquivo principal é reiniciado vazio.
 */
import { readFileFromRepo, writeFileToRepo } from '../plugins/_server';

export interface EmailLogRecord {
  email: string;
  sequenceIndex: number;
  sentAt: string;
  success: boolean;
}

const LOG_PATH = 'src/data/emailsSent.json';
const ROTATION_BYTES = 400 * 1024; // 400KB

/** Retorna Set de chaves "email::sequenceIndex" já enviados com sucesso. */
export async function getSentSet(): Promise<Set<string>> {
  const raw = await readFileFromRepo(LOG_PATH);
  const records: EmailLogRecord[] = raw ? JSON.parse(raw) : [];
  return new Set(records.filter(r => r.success).map(r => `${r.email}::${r.sequenceIndex}`));
}

/** Conta envios bem-sucedidos na última hora. */
export async function countRecentSends(windowMs = 60 * 60 * 1000): Promise<number> {
  const raw = await readFileFromRepo(LOG_PATH);
  const records: EmailLogRecord[] = raw ? JSON.parse(raw) : [];
  const cutoff = new Date(Date.now() - windowMs).toISOString();
  return records.filter(r => r.success && r.sentAt >= cutoff).length;
}

/**
 * Adiciona novos registros ao log.
 * Se o arquivo ultrapassar ROTATION_BYTES, arquiva o conteúdo atual antes.
 */
export async function appendEmailRecords(newRecords: EmailLogRecord[]): Promise<void> {
  if (newRecords.length === 0) return;

  const raw = await readFileFromRepo(LOG_PATH);
  const existing: EmailLogRecord[] = raw ? JSON.parse(raw) : [];
  const currentBytes = raw ? Buffer.byteLength(raw, 'utf-8') : 0;

  if (currentBytes > ROTATION_BYTES && existing.length > 0) {
    // Arquiva o conteúdo atual com timestamp YYYY-MM
    const now = new Date();
    const tag = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const archivePath = `src/data/emailsSent-${tag}.json`;
    await writeFileToRepo(archivePath, JSON.stringify(existing, null, 2), {
      message: `CMS: Arquivo emailsSent rotacionado para ${tag}`,
    });
    // Reinicia o log principal só com os novos registros
    await writeFileToRepo(LOG_PATH, JSON.stringify(newRecords, null, 2), {
      message: `Cron: email log rotacionado — ${newRecords.length} novos registros`,
    });
    return;
  }

  const updated = [...existing, ...newRecords];
  await writeFileToRepo(LOG_PATH, JSON.stringify(updated, null, 2), {
    message: `Cron: email sequences — ${newRecords.filter(r => r.success).length} enviados`,
  });
}
```

- [ ] **Step 2: Verificar build**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -20
```

Esperado: 0 erros.

- [ ] **Step 3: Commit**

```bash
cd C:\Projects\msia-scaffold
git add src/lib/emailLog.ts
git commit -m "feat(p0): emailLog com rotação automática quando >400KB"
```

---

### Task 4: Atualizar `process-sequences.ts` para usar emailLog

**Files:**
- Modify: `src/pages/api/cron/process-sequences.ts`

- [ ] **Step 1: Substituir leitura/escrita direta pelo emailLog**

Localizar as linhas 56-136 do arquivo e aplicar as seguintes mudanças:

1. Adicionar import no topo (após os imports existentes):

```typescript
import { getSentSet, appendEmailRecords, type EmailLogRecord } from '../../../lib/emailLog';
```

2. Substituir o bloco de leitura do histórico (linhas 55-69 — do `// Lê histórico de envios` até o `const sentSet`):

```typescript
        // Lê histórico de envios via emailLog (com rotação automática)
        const sentSet = await getSentSet();
```

3. Substituir a declaração `const newRecords: typeof emailsSent = [];` por:

```typescript
        const newRecords: EmailLogRecord[] = [];
```

4. Substituir o bloco de persistência no final (linhas 128-136 — do `// Persiste novos registros` até o `}`):

```typescript
        // Persiste novos registros via emailLog (com rotação automática)
        await appendEmailRecords(newRecords);
```

5. Remover o import de `readDataFile` se não for mais usado em outro lugar (checar — `readDataFile` ainda é usado na linha 41 para `siteConfig.json`, então manter).

- [ ] **Step 2: Verificar build**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -20
```

Esperado: 0 erros. Confirmar que o arquivo compila sem `emailsSent` referenciado.

- [ ] **Step 3: Commit e tag do Batch 1**

```bash
cd C:\Projects\msia-scaffold
git add src/pages/api/cron/process-sequences.ts
git commit -m "fix(p0): process-sequences usa emailLog — sem crescimento ilimitado de emailsSent.json"
git tag batch-p0-done
```

---

## BATCH 2 — P1: Segurança + Auth + Operacional

---

### Task 5: Atualizar `auth.ts` — timingSafeEqual + brute force helpers

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Reescrever o arquivo com as melhorias**

```typescript
/**
 * Auth por senha HMAC-SHA256 sem deps externas.
 * Cookie: admin_session (httpOnly, Secure em prod, SameSite=Lax, 7 dias)
 * Cookie: login_attempts (brute force protection, 15min)
 */

const COOKIE_NAME = 'admin_session';
const ATTEMPTS_COOKIE = 'login_attempts';
const EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const ATTEMPTS_EXPIRES_SEC = 15 * 60; // 15 min
export const MAX_LOGIN_ATTEMPTS = 5;

async function hmac(secret: string, data: string): Promise<string> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Comparação em tempo constante — previne timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
        // Executa a comparação mesmo com comprimento diferente para normalizar tempo
        let r = 1;
        const maxLen = Math.max(a.length, b.length);
        for (let i = 0; i < maxLen; i++) {
            r |= (a.charCodeAt(i % a.length) ^ b.charCodeAt(i % b.length));
        }
        return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

/** Cria a string de cookie de sessão assinada. Retorna null se ADMIN_SECRET não definido ou senha incorreta. */
export async function createSession(password: string): Promise<string | null> {
    const secret = import.meta.env.ADMIN_SECRET;
    if (!secret) return null;
    if (password !== secret) return null;

    const expires = Date.now() + EXPIRES_MS;
    const payload = `${expires}`;
    const sig = await hmac(secret, payload);
    return `${payload}.${sig}`;
}

/** Valida cookie de sessão. Retorna true se válido e não expirado. */
export async function validateSession(cookieValue: string | undefined): Promise<boolean> {
    if (!cookieValue) return false;
    const secret = import.meta.env.ADMIN_SECRET;
    if (!secret) return false;

    const parts = cookieValue.split('.');
    if (parts.length !== 2) return false;

    const [expStr, sig] = parts;
    const expires = parseInt(expStr, 10);
    if (isNaN(expires) || Date.now() > expires) return false;

    const expected = await hmac(secret, expStr);
    return timingSafeEqual(expected, sig); // timing-safe
}

export interface AttemptsPayload { count: number; since: number }

/** Cria cookie de tentativas assinado para brute force protection. */
export async function signAttempts(count: number, since: number): Promise<string> {
    const secret = import.meta.env.ADMIN_SECRET || 'fallback';
    const payload = `${count}:${since}`;
    const sig = await hmac(secret, payload);
    return `${payload}.${sig}`;
}

/** Lê e valida cookie de tentativas. Retorna null se inválido ou expirado. */
export async function readAttempts(cookieValue: string | undefined): Promise<AttemptsPayload | null> {
    if (!cookieValue) return null;
    const secret = import.meta.env.ADMIN_SECRET || 'fallback';
    const dotIdx = cookieValue.lastIndexOf('.');
    if (dotIdx === -1) return null;
    const payload = cookieValue.slice(0, dotIdx);
    const sig = cookieValue.slice(dotIdx + 1);
    const expected = await hmac(secret, payload);
    if (!timingSafeEqual(expected, sig)) return null;
    const parts = payload.split(':');
    if (parts.length !== 2) return null;
    const count = parseInt(parts[0], 10);
    const since = parseInt(parts[1], 10);
    if (isNaN(count) || isNaN(since)) return null;
    // Expira após 15min
    if (Date.now() - since > ATTEMPTS_EXPIRES_SEC * 1000) return null;
    return { count, since };
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME;
export const ATTEMPTS_COOKIE_EXPORT = ATTEMPTS_COOKIE;
export const ATTEMPTS_EXPIRES_SEC_EXPORT = ATTEMPTS_EXPIRES_SEC;
```

- [ ] **Step 2: Verificar build**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -20
```

Esperado: 0 erros.

- [ ] **Step 3: Commit**

```bash
cd C:\Projects\msia-scaffold
git add src/lib/auth.ts
git commit -m "fix(p1): auth — timingSafeEqual + helpers para brute force protection"
```

---

### Task 6: Atualizar `login.ts` — flag Secure + brute force protection

**Files:**
- Modify: `src/pages/api/admin/login.ts`

- [ ] **Step 1: Reescrever o arquivo**

```typescript
import type { APIRoute } from 'astro';
import {
    createSession,
    signAttempts,
    readAttempts,
    MAX_LOGIN_ATTEMPTS,
    COOKIE_NAME_EXPORT as COOKIE_NAME,
    ATTEMPTS_COOKIE_EXPORT as ATTEMPTS_COOKIE,
    ATTEMPTS_EXPIRES_SEC_EXPORT as ATTEMPTS_EXPIRES_SEC,
} from '../../../lib/auth';

export const prerender = false;

const SESSION_EXPIRES_SEC = 7 * 24 * 60 * 60; // 7 dias

export const POST: APIRoute = async ({ request }) => {
    try {
        const { password } = await request.json();
        if (!password) {
            return new Response(JSON.stringify({ error: 'Senha obrigatória.' }), { status: 400 });
        }

        // Lê cookie de tentativas
        const cookieHeader = request.headers.get('cookie') || '';
        const cookieMap: Record<string, string> = {};
        for (const part of cookieHeader.split(';')) {
            const [k, ...v] = part.trim().split('=');
            if (k) cookieMap[k.trim()] = decodeURIComponent(v.join('='));
        }
        const attempts = await readAttempts(cookieMap[ATTEMPTS_COOKIE]);

        // Bloqueia se atingiu o limite
        if (attempts && attempts.count >= MAX_LOGIN_ATTEMPTS) {
            const remainingSec = Math.ceil((ATTEMPTS_EXPIRES_SEC * 1000 - (Date.now() - attempts.since)) / 1000);
            return new Response(
                JSON.stringify({ error: `Muitas tentativas. Aguarde ${remainingSec}s.` }),
                { status: 429 }
            );
        }

        const session = await createSession(password);
        const secureFlag = import.meta.env.PROD ? '; Secure' : '';

        if (!session) {
            // Login falhou — incrementa contador
            const newCount = (attempts?.count || 0) + 1;
            const since = attempts?.since || Date.now();
            const attemptsToken = await signAttempts(newCount, since);
            const attemptsCookie = `${ATTEMPTS_COOKIE}=${encodeURIComponent(attemptsToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ATTEMPTS_EXPIRES_SEC}${secureFlag}`;

            return new Response(JSON.stringify({ error: 'Senha incorreta.' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', 'Set-Cookie': attemptsCookie },
            });
        }

        // Login OK — limpa cookie de tentativas + seta sessão
        const sessionCookie = `${COOKIE_NAME}=${encodeURIComponent(session)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_EXPIRES_SEC}${secureFlag}`;
        const clearAttempts = `${ATTEMPTS_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`;

        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: [
                ['Content-Type', 'application/json'],
                ['Set-Cookie', sessionCookie],
                ['Set-Cookie', clearAttempts],
            ] as any,
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
```

- [ ] **Step 2: Verificar build**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -20
```

Esperado: 0 erros.

- [ ] **Step 3: Commit**

```bash
cd C:\Projects\msia-scaffold
git add src/pages/api/admin/login.ts
git commit -m "fix(p1): login — flag Secure em prod + brute force protection via cookie assinado"
```

---

### Task 7: Retry exponencial em `repoIo.ts` e `plugins/_server.ts`

**Files:**
- Modify: `src/lib/repoIo.ts` (função `repoWriteFile`)
- Modify: `src/plugins/_server.ts` (função `writeFileToRepo`)

- [ ] **Step 1: Adicionar helper de retry em `repoIo.ts`**

Adicionar a função helper antes de `repoWriteFile` e atualizar a função:

```typescript
/** Aguarda ms milissegundos. */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Escreve um arquivo. Pode ser texto (utf-8) ou binário (Buffer).
 * Em prod, cria/atualiza via API do GitHub (com commit message).
 * Retry com backoff exponencial em caso de 409 (SHA mismatch) ou falha de rede.
 */
export async function repoWriteFile(
  path: string,
  data: string | Buffer,
  opts?: { message?: string }
): Promise<void> {
  const message = opts?.message || `CMS: write ${path}`;
  const env = ghEnv();
  if (!env) {
    const absPath = nodePath.join(PROJECT_ROOT, path);
    await fs.mkdir(nodePath.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, data as any);
    return;
  }

  // Aviso de arquivo grande antes de tentar
  const contentBytes = Buffer.isBuffer(data)
    ? data.length
    : Buffer.byteLength(data as string, 'utf-8');
  if (contentBytes > 900_000) {
    console.warn(`[repoIo] AVISO: ${path} tem ${Math.round(contentBytes / 1024)}KB — próximo do limite de 1MB da GitHub API`);
  }

  const url = `https://api.github.com/repos/${env.owner}/${env.repo}/contents/${path}`;
  const content = Buffer.isBuffer(data) ? data.toString('base64') : Buffer.from(data, 'utf-8').toString('base64');
  const delays = [500, 1000, 2000];

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    // Busca SHA atual (necessário a cada tentativa para ter o SHA fresco)
    let sha: string | undefined;
    try {
      const head = await fetch(url, { headers: env.headers });
      if (head.ok) {
        const d = await head.json();
        sha = d.sha;
      }
    } catch {}

    const body: any = { message, content };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...env.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) return; // Sucesso

    if (res.status === 409 && attempt < delays.length) {
      // SHA mismatch — aguarda e retenta com SHA fresco
      await sleep(delays[attempt]);
      continue;
    }

    const err = await res.json().catch(() => ({}));
    throw new Error(`Falha ao escrever ${path} (tentativa ${attempt + 1}): ${err.message || res.status}`);
  }
}
```

- [ ] **Step 2: Adicionar retry em `plugins/_server.ts`**

Adicionar `sleep` helper e atualizar `writeFileToRepo`:

```typescript
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Escreve arquivo de texto no repo (dev: filesystem / prod: GitHub API) */
export async function writeFileToRepo(
    filePath: string,
    content: string,
    options: { message?: string; token?: string; owner?: string; repo?: string } = {}
): Promise<boolean> {
    const token = options.token || process.env.GITHUB_TOKEN || '';
    const owner = options.owner || process.env.GITHUB_OWNER || '';
    const repo = options.repo || process.env.GITHUB_REPO || '';
    const isDevMode = !token || !owner || !repo;

    if (isDevMode) {
        const absPath = resolve(process.cwd(), filePath);
        mkdirSync(dirname(absPath), { recursive: true });
        writeFileSync(absPath, content, 'utf-8');
        return true;
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
    };
    const delays = [500, 1000, 2000];

    for (let attempt = 0; attempt <= delays.length; attempt++) {
        let sha: string | undefined;
        const existing = await fetch(apiUrl, { headers });
        if (existing.ok) {
            const data = await existing.json();
            sha = data.sha;
        }

        const body: any = {
            message: options.message || `CMS: ${filePath}`,
            content: Buffer.from(content).toString('base64'),
        };
        if (sha) body.sha = sha;

        const res = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) });
        if (res.ok) return true;

        if (res.status === 409 && attempt < delays.length) {
            await sleep(delays[attempt]);
            continue;
        }
        return false;
    }
    return false;
}
```

- [ ] **Step 3: Verificar build**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -20
```

Esperado: 0 erros.

- [ ] **Step 4: Commit**

```bash
cd C:\Projects\msia-scaffold
git add src/lib/repoIo.ts src/plugins/_server.ts
git commit -m "fix(p1): retry exponencial (3x) em writes GitHub — SHA mismatch e rede"
```

---

### Task 8: Rate limit em `send-email.ts` via emailLog

**Files:**
- Modify: `src/pages/api/admin/plugins/email-list/send-email.ts`

- [ ] **Step 1: Adicionar rate limit**

Adicionar import no topo:

```typescript
import { countRecentSends } from '../../../../../lib/emailLog';
```

Adicionar check após a validação de `senderEmail` (após a linha que retorna 400 para senderEmail vazio), antes do `sendTransactionalEmail`:

```typescript
        // Rate limit: máximo 500 emails/hora (configurável em siteConfig.emailHourlyLimit)
        const hourlyLimit: number = siteConfig?.emailHourlyLimit ?? 500;
        const recentSends = await countRecentSends();
        if (recentSends >= hourlyLimit) {
            return json({
                success: false,
                message: `Limite de ${hourlyLimit} emails/hora atingido. Tente novamente em instantes.`,
            }, 429);
        }
```

- [ ] **Step 2: Verificar build**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
cd C:\Projects\msia-scaffold
git add src/pages/api/admin/plugins/email-list/send-email.ts
git commit -m "fix(p1): send-email — rate limit 500/hora via emailLog"
```

---

### Task 9: Limite 10MB + atomicCommit em `import.ts` + vercel.json

**Files:**
- Modify: `src/pages/api/admin/import.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Atualizar `vercel.json`**

Adicionar bloco `functions` no JSON existente (preservar `git`, `crons`, `rewrites`):

```json
{
  "git": {
    "deploymentEnabled": {
      "main": false
    }
  },
  "crons": [
    {
      "path": "/api/cron/process-sequences",
      "schedule": "0 8 * * *"
    }
  ],
  "rewrites": [
    { "source": "/search/:term", "destination": "/search?q=:term" }
  ],
  "functions": {
    "src/pages/api/admin/import.ts": {
      "maxDuration": 60,
      "memory": 1024
    }
  }
}
```

- [ ] **Step 2: Atualizar `import.ts` — limite 10MB + atomicCommit no apply**

Duas mudanças:

1. Linha 9: `const MAX_ZIP_SIZE = 4 * 1024 * 1024;` → `const MAX_ZIP_SIZE = 10 * 1024 * 1024;`

2. Adicionar import no topo:
```typescript
import { atomicCommit, type AtomicFile } from '../../../lib/repoAtomicCommit';
```

3. Substituir o bloco `// Mode = apply` (de `const writeOne = async` até o final do loop `for`) pelo seguinte:

```typescript
    // Mode = apply: coleta todos os arquivos em memória e comita atomicamente em batches de 10
    const toWrite: Array<{ f: typeof allFiles[number]; record: ImportResult['posts'][number] }> = [];
    for (const f of allFiles) {
      const record = f.type === 'post'
        ? posts.find((p) => p.name === f.name)!
        : images.find((p) => p.name === f.name)!;
      if (record.exists && conflictPolicy === 'skip') {
        record.status = 'skipped';
        continue;
      }
      toWrite.push({ f, record });
    }

    // Processa em batches de 10 (atomicCommit por batch)
    const BATCH_SIZE = 10;
    for (let i = 0; i < toWrite.length; i += BATCH_SIZE) {
      const batch = toWrite.slice(i, i + BATCH_SIZE);
      const atomicFiles: AtomicFile[] = [];

      for (const { f, record } of batch) {
        try {
          const isText = f.type === 'post';
          const content = isText
            ? await f.entry.async('string')
            : Buffer.from(await f.entry.async('uint8array')).toString('base64');
          // Para arquivos binários, escrita individual (atomicCommit só suporta texto)
          if (!isText) {
            await repoWriteFile(f.targetPath, Buffer.from(await f.entry.async('uint8array')), {
              message: `MSIA Import: image ${f.name}`,
            });
          } else {
            atomicFiles.push({ path: f.targetPath, content });
          }
          record.status = record.exists ? 'overwritten' : 'created';
        } catch (err: any) {
          record.status = 'error';
          record.error = err?.message || 'erro desconhecido';
        }
      }

      if (atomicFiles.length > 0) {
        try {
          await atomicCommit(atomicFiles, `MSIA Import: batch ${Math.floor(i / BATCH_SIZE) + 1} (${atomicFiles.length} posts)`);
        } catch (err: any) {
          // Marca todos do batch como erro
          for (const { record } of batch) {
            if (record.status !== 'skipped') {
              record.status = 'error';
              record.error = err?.message || 'erro no commit atômico';
            }
          }
        }
      }
    }
```

- [ ] **Step 3: Verificar build**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
cd C:\Projects\msia-scaffold
git add src/pages/api/admin/import.ts vercel.json
git commit -m "fix(p1): import — limite 10MB + commits atômicos em batches + maxDuration 60s"
```

---

### Task 10: Credenciais Google — env var em vez de JSON

**Files:**
- Modify: `src/pages/api/admin/plugins/search-console/data.ts`
- Modify: `src/data/pluginsConfig.json`

- [ ] **Step 1: Atualizar `search-console/data.ts`**

Substituir as linhas que leem `gsc.serviceAccountJson` (linhas 36-44):

```typescript
        const config = readPluginsConfig();
        const gsc = config?.searchConsole;

        // Credenciais via env var (nunca via pluginsConfig.json — seria commitado no repo)
        const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';

        if (!serviceAccountJson?.trim() || !gsc?.siteUrl?.trim()) {
            return new Response(JSON.stringify({
                error: 'Search Console não configurado. Adicione GOOGLE_SERVICE_ACCOUNT_JSON no Vercel e siteUrl no painel.',
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const credentials = parseServiceAccountJson(serviceAccountJson);
        const siteUrl = gsc.siteUrl.trim();
```

- [ ] **Step 2: Remover `serviceAccountJson` de `pluginsConfig.json`**

Substituir o bloco `searchConsole`:

```json
    "searchConsole": {
        "verificationTag": "",
        "siteUrl": ""
    },
```

(Remover apenas o campo `serviceAccountJson`. Manter `verificationTag` e `siteUrl`.)

- [ ] **Step 3: Verificar build**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit e tag do Batch 2**

```bash
cd C:\Projects\msia-scaffold
git add src/pages/api/admin/plugins/search-console/data.ts src/data/pluginsConfig.json
git commit -m "fix(p1): search console — credenciais via env var GOOGLE_SERVICE_ACCOUNT_JSON"
git tag batch-p1-done
```

---

## BATCH 3 — P2: Melhorias + Plugin Slots

---

### Task 11: Cookie parsing robusto em `middleware.ts`

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Substituir o parse manual de cookies**

Localizar as linhas 82-88 (bloco `const cookieHeader ... const sessionCookie`) e substituir por:

```typescript
    // Parse robusto — suporta valores com '=', espaços, e chars especiais
    const cookieHeader = context.request.headers.get('cookie') || '';
    const cookies: Record<string, string> = {};
    for (const pair of cookieHeader.split(';')) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) continue;
        const key = pair.slice(0, eqIdx).trim();
        const val = pair.slice(eqIdx + 1).trim();
        if (key) cookies[key] = decodeURIComponent(val);
    }
    const sessionCookie = cookies[COOKIE_NAME];
```

- [ ] **Step 2: Verificar build**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
cd C:\Projects\msia-scaffold
git add src/middleware.ts
git commit -m "fix(p2): middleware — cookie parse robusto (suporta valor com '=' e chars especiais)"
```

---

### Task 12: Cache invalidation em `github.ts` após writes

**Files:**
- Modify: `src/pages/api/admin/github.ts`

> Contexto: `github.ts` tem `readCache` (Map) com TTL 30s e a função `invalidateCache(path)` já definida. O problema: as operações de write dentro do mesmo arquivo não chamam `invalidateCache`, então leituras subsequentes na mesma instância podem servir o arquivo antigo.

- [ ] **Step 1: Encontrar o handler de write em `github.ts`**

```bash
cd C:\Projects\msia-scaffold && grep -n "case 'write'\|PUT\|invalidateCache" src/pages/api/admin/github.ts
```

- [ ] **Step 2: Adicionar `invalidateCache(path)` após cada write bem-sucedido**

Localizar cada bloco `if (res.ok)` ou `case 'write':` que faz um PUT na GitHub API e adicionar a chamada logo após o write:

```typescript
// Após cada PUT bem-sucedido no handler de prod:
if (res.ok) {
    invalidateCache(path); // invalida cache local após escrita
    // ... resto do código existente
}

// Após cada write no handler de dev (handleDev, case 'write'):
// Antes do return de sucesso:
invalidateCache(path);
```

- [ ] **Step 3: Verificar build e commit**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -5
git add src/pages/api/admin/github.ts
git commit -m "fix(p2): github.ts — invalidateCache() chamado após writes para evitar leitura stale"
```

---

### Task 13: Regex de filename mais estrita em `import.ts`

**Files:**
- Modify: `src/pages/api/admin/import.ts`

- [ ] **Step 1: Atualizar `isSafeFilename`**

Substituir a função `isSafeFilename` (linhas 12-26):

```typescript
/** Sanitiza nome de arquivo — rejeita path traversal e chars não-ASCII. */
function isSafeFilename(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  if (name.includes('..')) return false;
  if (name.startsWith('/') || name.startsWith('\\')) return false;
  if (name.includes('\0') || name.includes('\\')) return false;
  // Cada segmento: apenas alfanumérico, hífen, underline, ponto. Sem espaços, sem unicode.
  const segments = name.split('/');
  for (const seg of segments) {
    if (!seg || seg === '.' || seg === '..') return false;
    if (!/^[a-z0-9\-_.]+$/i.test(seg)) return false;
  }
  return true;
}
```

- [ ] **Step 2: Verificar build e commit**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -5
git add src/pages/api/admin/import.ts
git commit -m "fix(p2): import — filename regex sem espaços nem unicode"
```

---

### Task 14: Campo `unsubscribedAt` em subscribers + filtro no cron

**Files:**
- Modify: `src/pages/api/cron/process-sequences.ts`

- [ ] **Step 1: Atualizar o filtro de subscribers no cron**

Localizar a linha que define `if (subscribers.length === 0)` e o loop `outer: for (const sub of subscribers)`.

Substituir a interface do subscriber e adicionar filtro antes do loop:

```typescript
        // Subscribers com interface extendida (suporta unsubscribedAt)
        const activeSubscribers = subscribers.filter(
            (s: { email: string; subscribedAt: string; unsubscribedAt?: string }) => !s.unsubscribedAt
        );

        if (activeSubscribers.length === 0) return json({ processed: 0, sent: 0, failed: 0, reason: 'no_active_subscribers' });
```

Substituir `for (const sub of subscribers)` por `for (const sub of activeSubscribers)`.

- [ ] **Step 2: Verificar build e commit**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -5
git add src/pages/api/cron/process-sequences.ts
git commit -m "fix(p2): cron — filtra unsubscribed (campo unsubscribedAt)"
```

---

### Task 15: escapeHtml no corpo dos emails do cron

**Files:**
- Modify: `src/pages/api/cron/process-sequences.ts`

- [ ] **Step 1: Adicionar escapeHtml e aplicar**

Adicionar função helper no topo do arquivo (após os imports):

```typescript
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
```

Substituir as linhas 97-100 (montagem do `htmlContent`):

```typescript
                const htmlContent = seq.body
                    .split('\n')
                    .map(line => `<p>${escapeHtml(line)}</p>`)
                    .join('');
```

- [ ] **Step 2: Verificar build e commit**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -5
git add src/pages/api/cron/process-sequences.ts
git commit -m "fix(p2): cron email — escapeHtml no corpo das sequências"
```

---

### Task 16: AbortController no AI generator

**Files:**
- Modify: `src/pages/api/admin/plugins/ai/generate.ts`

- [ ] **Step 1: Adicionar timeout de 60s no ReadableStream**

Localizar o `new ReadableStream({ async start(controller) {` e adicionar um AbortController que cancela após 60s se o stream não fechar:

```typescript
        const timeoutMs = 60_000;
        let timeoutId: ReturnType<typeof setTimeout>;

        const stream = new ReadableStream({
            async start(controller) {
                timeoutId = setTimeout(() => {
                    controller.enqueue(encoder.encode(send({ step: 'error', error: 'Tempo limite de geração atingido (60s).' })));
                    controller.close();
                }, timeoutMs);

                try {
                    // ... (código existente sem alterações)
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
                    controller.enqueue(encoder.encode(send({ step: 'error', error: msg })));
                    console.error('✗ Erro ao gerar post com IA:', err);
                } finally {
                    clearTimeout(timeoutId);
                    controller.close();
                }
            },
        });
```

- [ ] **Step 2: Verificar build e commit**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -5
git add src/pages/api/admin/plugins/ai/generate.ts
git commit -m "fix(p2): ai generator — timeout de 60s no stream SSE"
```

---

### Task 17: Cache 30s + timeout 5s em `deploy-status.ts`

**Files:**
- Modify: `src/pages/api/admin/deploy-status.ts`

- [ ] **Step 1: Reescrever `deploy-status.ts` com cache e timeouts**

```typescript
/**
 * deploy-status.ts — Verifica status do deploy via GitHub Deployments API
 * Cache de 30s em módulo. Timeout de 5s por fetch.
 */
import type { APIRoute } from 'astro';

export const prerender = false;

let _cache: { data: Record<string, unknown>; at: number } | null = null;
const CACHE_MS = 30_000;
const FETCH_TIMEOUT_MS = 5_000;

async function fetchWithTimeout(url: string, headers: Record<string, string>): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        return await fetch(url, { headers, signal: controller.signal });
    } finally {
        clearTimeout(id);
    }
}

export const GET: APIRoute = async () => {
    const idle = new Response(JSON.stringify({ state: 'idle' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
    });

    // Serve do cache se ainda válido
    if (_cache && Date.now() - _cache.at < CACHE_MS) {
        return new Response(JSON.stringify(_cache.data), {
            status: 200, headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const token = (import.meta.env.GITHUB_TOKEN ?? '').trim();
        const owner = (import.meta.env.GITHUB_OWNER ?? '').trim();
        const repo  = (import.meta.env.GITHUB_REPO ?? '').trim();

        if (!token || !owner || !repo) return idle;

        const headers = {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
        };

        const deploymentsRes = await fetchWithTimeout(
            `https://api.github.com/repos/${owner}/${repo}/deployments?per_page=1&environment=Production`,
            headers
        );
        if (!deploymentsRes.ok) return idle;

        const deployments = await deploymentsRes.json() as any[];
        if (deployments.length === 0) return idle;

        const deployment = deployments[0];

        const statusRes = await fetchWithTimeout(deployment.statuses_url, headers);
        if (!statusRes.ok) return idle;

        const statuses = await statusRes.json() as any[];
        const latest = statuses[0];

        if (!latest) {
            const data = { state: 'building', updatedAt: deployment.created_at };
            _cache = { data, at: Date.now() };
            return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        let state = 'idle';
        if (latest.state === 'pending' || latest.state === 'in_progress' || latest.state === 'queued') {
            state = 'building';
        } else if (latest.state === 'success') {
            const deployedAt = new Date(latest.created_at).getTime();
            state = deployedAt > Date.now() - 5 * 60 * 1000 ? 'ready' : 'idle';
        } else if (latest.state === 'failure' || latest.state === 'error') {
            const deployedAt = new Date(latest.created_at).getTime();
            state = deployedAt > Date.now() - 5 * 60 * 1000 ? 'error' : 'idle';
        }

        const data = {
            state,
            url: latest.target_url || latest.log_url || '',
            updatedAt: latest.created_at,
            environment: deployment.environment,
        };
        _cache = { data, at: Date.now() };
        return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch {
        return idle;
    }
};
```

- [ ] **Step 2: Verificar build e commit**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -5
git add src/pages/api/admin/deploy-status.ts
git commit -m "fix(p2): deploy-status — cache 30s + timeout 5s por fetch"
```

---

### Task 18: Zod schemas para arquivos JSON críticos (P2-3)

**Files:**
- Create: `src/lib/schemas.ts`
- Modify: `src/plugins/_server.ts` (readDataFile usa schema)

- [ ] **Step 1: Criar `src/lib/schemas.ts`**

```typescript
/**
 * schemas.ts — Schemas Zod para os data files JSON do CMS.
 * Garante que dados corrompidos gerem erro imediato com mensagem clara,
 * em vez de falha silenciosa em runtime.
 */
import { z } from 'zod';

export const SiteConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  url: z.string(),
  author: z.string().optional(),
  language: z.string().default('pt-BR'),
  logo: z.string().optional(),
  favicon: z.string().optional(),
  postUrlPrefix: z.string().optional(),
  emailHourlyLimit: z.number().optional(),
  theme: z.object({
    primary: z.string().optional(),
    dark: z.string().optional(),
    fontDisplay: z.string().optional(),
    fontBody: z.string().optional(),
  }).optional(),
  social: z.record(z.string()).optional(),
  contact: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
  legal: z.record(z.string()).optional(),
}).passthrough();

export const CategoryEntrySchema = z.union([
  z.string(),
  z.object({ name: z.string(), slug: z.string(), description: z.string().optional() }),
]);
export const CategoriesSchema = z.array(CategoryEntrySchema);

export const AuthorSchema = z.object({
  name: z.string(),
  slug: z.string(),
  bio: z.string().optional(),
  avatar: z.string().optional(),
}).passthrough();
export const AuthorsSchema = z.array(AuthorSchema);

export const SubscriberSchema = z.object({
  email: z.string().email(),
  subscribedAt: z.string(),
  unsubscribedAt: z.string().optional(),
}).passthrough();
export const SubscribersSchema = z.array(SubscriberSchema);

export const RedirectSchema = z.object({
  id: z.string().optional(),
  from: z.string(),
  to: z.string(),
  type: z.number().optional(),
  enabled: z.boolean().optional(),
}).passthrough();
export const RedirectsSchema = z.array(RedirectSchema);

export const EmailLogRecordSchema = z.object({
  email: z.string(),
  sequenceIndex: z.number(),
  sentAt: z.string(),
  success: z.boolean(),
});
export const EmailsLogSchema = z.array(EmailLogRecordSchema);

/** Parse seguro — lança com mensagem descritiva em caso de schema inválido. */
export function safeParse<T>(schema: z.ZodType<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Schema inválido em ${context}: ${issues}`);
  }
  return result.data;
}
```

- [ ] **Step 2: Verificar se `zod` está instalado**

```bash
cd C:\Projects\msia-scaffold && grep '"zod"' package.json
```

Se não estiver: `bun add zod`

- [ ] **Step 3: Verificar build**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -10
```

- [ ] **Step 4: Usar `safeParse` no `emailLog.ts` (validação de dados lidos do repo)**

Em `src/lib/emailLog.ts`, após o `JSON.parse(raw)` em `getSentSet` e `appendEmailRecords`, adicionar validação:

```typescript
import { EmailsLogSchema, safeParse } from './schemas';

// Em getSentSet():
const records = safeParse(EmailsLogSchema, raw ? JSON.parse(raw) : [], 'emailsSent.json');

// Em appendEmailRecords():
const existing = safeParse(EmailsLogSchema, raw ? JSON.parse(raw) : [], 'emailsSent.json');
```

- [ ] **Step 5: Commit**

```bash
cd C:\Projects\msia-scaffold
git add src/lib/schemas.ts src/lib/emailLog.ts
git commit -m "feat(p2): schemas Zod para data files — safeParse com mensagem descritiva"
```

---

### Task 20: Remover `validateSession` redundante dos plugins

**Files:**
- Modify: `src/pages/api/admin/plugins/email-list/send-email.ts`
- Modify: `src/pages/api/admin/plugins/email-list/leads.ts`
- Modify: `src/pages/api/admin/plugins/ai/generate.ts`
- Modify: `src/pages/api/admin/plugins/search-console/data.ts`

- [ ] **Step 1: Remover auth duplicado de cada arquivo**

Em cada arquivo, remover:
1. O import de `validateSession` (se não usado em outro lugar no mesmo arquivo)
2. O bloco de parse de cookies
3. O `if (!await validateSession(...))` com o return 401

O middleware já garante que nenhuma request chega aqui sem sessão válida.

Para `send-email.ts` — remover linhas 9-31 (import validateSession + bloco de cookies + check):

```typescript
// REMOVER:
import { validateSession } from '../../../../../lib/auth';

// REMOVER:
        const cookieHeader = request.headers.get('cookie') || '';
        const cookies = Object.fromEntries(
            cookieHeader.split(';').map(c => {
                const [k, ...v] = c.trim().split('=');
                return [k, decodeURIComponent(v.join('='))];
            })
        );
        if (!await validateSession(cookies['admin_session'])) {
            return json({ success: false, message: 'Não autorizado.' }, 401);
        }
```

Aplicar o mesmo padrão (remover import + bloco de cookies + if validateSession) em `leads.ts`, `generate.ts` e `search-console/data.ts`.

- [ ] **Step 2: Verificar build**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -20
```

Esperado: 0 erros. Se houver erro de "validateSession não importado mas usado", verificar se o arquivo usa `validateSession` em outro ponto e ajustar.

- [ ] **Step 3: Commit**

```bash
cd C:\Projects\msia-scaffold
git add src/pages/api/admin/plugins/email-list/send-email.ts \
        src/pages/api/admin/plugins/email-list/leads.ts \
        src/pages/api/admin/plugins/ai/generate.ts \
        src/pages/api/admin/plugins/search-console/data.ts
git commit -m "fix(p2): remove validateSession duplicada nos plugins (middleware já garante auth)"
```

---

### Task 21: Plugin slots condicionais

**Files:**
- Modify: `src/plugins/_slots/HeadPlugins.astro`
- Modify: `src/plugins/_slots/BodyEndPlugins.astro`
- Modify: `src/plugins/_slots/PostAfterPlugins.astro`
- Create: `src/plugins/_slots/BodyStartPlugins.astro`

> Nota: os slots já existem (`HeadPlugins.astro`, `BodyEndPlugins.astro`, etc.). A mudança é tornar cada import condicional no `enabled` do `pluginsConfig`.

- [ ] **Step 1: Atualizar `HeadPlugins.astro`**

```astro
---
import { readData } from '../../lib/readData';
const pluginsConfig = readData('pluginsConfig.json', {}) as any;

import GoogleTag from '../google-tag/GoogleTag.astro';
import MetaPixel from '../meta-pixel/MetaPixel.astro';
import AdSenseHead from '../adsense/AdSenseHead.astro';
---
{pluginsConfig?.googleAnalytics?.measurementId && <GoogleTag />}
{pluginsConfig?.metaPixel?.pixelId && <MetaPixel />}
{pluginsConfig?.adsense?.publisherId && <AdSenseHead />}
```

- [ ] **Step 2: Atualizar `BodyEndPlugins.astro`**

```astro
---
import { readData } from '../../lib/readData';
const pluginsConfig = readData('pluginsConfig.json', {}) as any;

import EmailPopup from '../email-list/EmailPopup.astro';
import CookieConsent from '../cookie-consent/CookieConsent.astro';
---
{pluginsConfig?.emailList?.popup?.enabled && <EmailPopup />}
{pluginsConfig?.cookieConsent?.enabled && <CookieConsent />}
```

- [ ] **Step 3: Atualizar `PostAfterPlugins.astro`**

```astro
---
import { readData } from '../../lib/readData';
const pluginsConfig = readData('pluginsConfig.json', {}) as any;

interface Props {
  currentSlug: string;
  category: string;
}
const { currentSlug, category } = Astro.props;

import RelatedPosts from '../related-posts/RelatedPosts.astro';
---
{pluginsConfig?.relatedPosts?.enabled && (
  <RelatedPosts currentSlug={currentSlug} category={category} />
)}
```

- [ ] **Step 4: Criar `BodyStartPlugins.astro`** (GTM noscript)

```astro
---
import { readData } from '../../lib/readData';
const pluginsConfig = readData('pluginsConfig.json', {}) as any;
const gtmId = pluginsConfig?.googleAnalytics?.measurementId || '';
const isGtm = gtmId.startsWith('GTM-');
---
{isGtm && (
  <noscript>
    <iframe
      src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
      height="0"
      width="0"
      style="display:none;visibility:hidden"
    />
  </noscript>
)}
```

- [ ] **Step 5: Verificar build**

```bash
cd C:\Projects\msia-scaffold && bun run build 2>&1 | tail -20
```

- [ ] **Step 6: Commit e tag do Batch 3**

```bash
cd C:\Projects\msia-scaffold
git add src/plugins/_slots/
git commit -m "feat(p2): plugin slots — renderização condicional via pluginsConfig + BodyStartPlugins"
git tag batch-p2-done
```

---

## Checklist de entrega final

- [ ] `bun run build` limpo sem erros
- [ ] Tags criadas: `batch-p0-done`, `batch-p1-done`, `batch-p2-done`
- [ ] ⚠️ Chave OpenAI em `pluginsConfig.json` revogada e campo zerado
- [ ] Documentar em README ou CLAUDE.md: `GOOGLE_SERVICE_ACCOUNT_JSON` é env var obrigatória para Search Console
