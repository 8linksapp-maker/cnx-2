/**
 * repoAtomicCommit.ts — Commit atômico via GitHub Git Tree API.
 * Um único commit agrupa N alterações de arquivo (texto e/ou binário).
 * Falha completamente ou tem sucesso completamente — sem estado intermediário.
 * Em dev (sem GITHUB_TOKEN), faz writes individuais no filesystem.
 */
import fs from 'node:fs/promises';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = nodePath.resolve(fileURLToPath(import.meta.url), '../../../');

export interface AtomicFile {
  /** Caminho relativo à raiz do repo, ex: "src/data/categories.json" */
  path: string;
  /** Conteúdo. Null remove o arquivo. */
  content: string | null;
  /** Codificação de `content`. 'utf-8' (default) para texto, 'base64' para binário (imagens). */
  encoding?: 'utf-8' | 'base64';
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
 * Retorna o SHA do novo commit (prod) ou null (dev).
 */
export async function atomicCommit(files: AtomicFile[], message: string): Promise<string | null> {
  if (files.length === 0) return null;
  const env = ghEnv();

  // Dev mode: writes individuais no filesystem
  if (!env) {
    for (const f of files) {
      const abs = nodePath.join(PROJECT_ROOT, f.path);
      if (f.content === null) {
        await fs.rm(abs, { force: true });
      } else {
        await fs.mkdir(nodePath.dirname(abs), { recursive: true });
        const data = f.encoding === 'base64' ? Buffer.from(f.content, 'base64') : f.content;
        await fs.writeFile(abs, data as any);
      }
    }
    return null;
  }

  const base = `https://api.github.com/repos/${env.owner}/${env.repo}`;

  // Binário precisa virar blob antes (a Tree API trata `content` como UTF-8).
  // Cria os blobs uma vez só — eles independem do HEAD, então ficam fora do retry.
  const blobShas = new Map<string, string>();
  await Promise.all(
    files
      .filter(f => f.content !== null && f.encoding === 'base64')
      .map(async f => {
        const res = await ghFetch(`${base}/git/blobs`, env, {
          method: 'POST',
          body: JSON.stringify({ content: f.content, encoding: 'base64' }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(`Falha ao criar blob de ${f.path}: ${e.message || res.status}`);
        }
        const d = await res.json();
        blobShas.set(f.path, d.sha);
      })
  );

  const treeItems = files.map(f => {
    if (f.content === null) {
      return { path: f.path, mode: '100644' as const, type: 'blob' as const, sha: null };
    }
    if (f.encoding === 'base64') {
      return { path: f.path, mode: '100644' as const, type: 'blob' as const, sha: blobShas.get(f.path)! };
    }
    return { path: f.path, mode: '100644' as const, type: 'blob' as const, content: f.content };
  });

  // Uma tentativa = lê HEAD atual, monta tree em cima dela, commita, avança a ref.
  // Se a ref já mudou entre a leitura e o PATCH (HEAD se mexeu), tenta de novo.
  async function attempt(): Promise<string> {
    const refRes = await ghFetch(`${base}/git/ref/heads/main`, env);
    if (!refRes.ok) throw new Error(`Falha ao buscar HEAD: ${refRes.status}`);
    const headCommitSha: string = (await refRes.json()).object.sha;

    const commitRes = await ghFetch(`${base}/git/commits/${headCommitSha}`, env);
    if (!commitRes.ok) throw new Error(`Falha ao buscar commit base: ${commitRes.status}`);
    const baseTreeSha: string = (await commitRes.json()).tree.sha;

    const treeRes = await ghFetch(`${base}/git/trees`, env, {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
    });
    if (!treeRes.ok) {
      const e = await treeRes.json().catch(() => ({}));
      throw new Error(`Falha ao criar tree: ${e.message || treeRes.status}`);
    }
    const newTreeSha: string = (await treeRes.json()).sha;

    const newCommitRes = await ghFetch(`${base}/git/commits`, env, {
      method: 'POST',
      body: JSON.stringify({ message, tree: newTreeSha, parents: [headCommitSha] }),
    });
    if (!newCommitRes.ok) {
      const e = await newCommitRes.json().catch(() => ({}));
      throw new Error(`Falha ao criar commit: ${e.message || newCommitRes.status}`);
    }
    const newCommitSha: string = (await newCommitRes.json()).sha;

    const updateRes = await ghFetch(`${base}/git/refs/heads/main`, env, {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommitSha }),
    });
    if (!updateRes.ok) {
      const e = await updateRes.json().catch(() => ({}));
      const err = new Error(`Falha ao atualizar ref: ${e.message || updateRes.status}`);
      (err as any).status = updateRes.status;
      throw err;
    }
    return newCommitSha;
  }

  try {
    return await attempt();
  } catch (err: any) {
    // HEAD avançou no meio do caminho (fast-forward perdido) → 1 retry em cima do novo HEAD
    if (err?.status === 409 || err?.status === 422) return await attempt();
    throw err;
  }
}
