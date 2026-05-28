/**
 * api/admin/commit.ts — Commit atômico de N arquivos num único commit.
 *
 * POST { files: [{ path, content, encoding? }], message }
 *   - content: string | null (null remove o arquivo)
 *   - encoding: 'utf-8' (default) | 'base64' (imagens/binário)
 *
 * Usado pelo editor para salvar capa + imagens inline + .md de uma vez —
 * 1 commit, 1 rebuild Vercel, sem estado parcial (imagem órfã).
 * Protegido pelo middleware (sessão admin), igual ao /api/admin/github.
 */
import type { APIRoute } from 'astro';
import { atomicCommit, type AtomicFile } from '../../../lib/repoAtomicCommit';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => null);
    const files = body?.files;
    const message = body?.message;

    if (!Array.isArray(files) || files.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum arquivo para commitar.' }), { status: 400 });
    }
    if (typeof message !== 'string' || !message.trim()) {
      return new Response(JSON.stringify({ error: 'Mensagem de commit obrigatória.' }), { status: 400 });
    }

    const normalized: AtomicFile[] = [];
    for (const f of files) {
      if (!f || typeof f.path !== 'string' || !f.path) {
        return new Response(JSON.stringify({ error: 'Arquivo sem path válido.' }), { status: 400 });
      }
      const content = f.content === null ? null : String(f.content);
      const encoding = f.encoding === 'base64' ? 'base64' : 'utf-8';
      normalized.push({ path: f.path, content, encoding });
    }

    const sha = await atomicCommit(normalized, message);
    return new Response(JSON.stringify({ success: true, sha }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Erro ao commitar.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
