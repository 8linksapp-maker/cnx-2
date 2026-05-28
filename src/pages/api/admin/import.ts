import type { APIRoute } from 'astro';
import JSZip from 'jszip';
import { repoFileExists, repoWriteFile } from '../../../lib/repoIo';

export const prerender = false;

// Limite do Vercel API gateway pra body do request (~4.5MB).
// Reservamos 4MB pra dar margem (FormData boundary + outros fields).
const MAX_ZIP_SIZE = 4 * 1024 * 1024;

/** Sanitiza nome de arquivo dentro do zip — rejeita path traversal */
function isSafeFilename(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  if (name.includes('..')) return false;
  if (name.startsWith('/') || name.startsWith('\\')) return false;
  if (name.includes('\0')) return false;
  if (name.includes('\\')) return false; // normaliza só /
  // Cada segmento entre / precisa ser ascii-safe (alfanumérico, hífen, underline, ponto, espaço).
  // Permite subdiretórios tipo "products/foo.jpg" mas bloqueia ".." e chars exóticos.
  const segments = name.split('/');
  for (const seg of segments) {
    if (!seg || seg === '.' || seg === '..') return false;
    if (!/^[\w\-. ]+$/i.test(seg)) return false;
  }
  return true;
}

interface ImportResult {
  manifest: any;
  posts: Array<{ name: string; size: number; exists: boolean; status?: 'created' | 'skipped' | 'overwritten' | 'error'; error?: string }>;
  images: Array<{ name: string; size: number; exists: boolean; status?: 'created' | 'skipped' | 'overwritten' | 'error'; error?: string }>;
  total_size: number;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const mode = (formData.get('mode') as string) || 'preview'; // preview | apply
    const conflictPolicy = (formData.get('conflict') as string) || 'skip'; // skip | overwrite

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'Envie um arquivo .zip no campo "file"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (file.size > MAX_ZIP_SIZE) {
      return new Response(JSON.stringify({
        error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite: ${(MAX_ZIP_SIZE / 1024 / 1024).toFixed(0)}MB. Divida o export em lotes menores.`
      }), { status: 413, headers: { 'Content-Type': 'application/json' } });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(buf);
    } catch {
      return new Response(JSON.stringify({ error: 'Arquivo inválido (não é um zip válido)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Lê manifest se houver
    let manifest: any = null;
    const manifestFile = zip.file('manifest.json');
    if (manifestFile) {
      try {
        manifest = JSON.parse(await manifestFile.async('string'));
      } catch {}
    }

    // Coleta posts e imagens
    const posts: ImportResult['posts'] = [];
    const images: ImportResult['images'] = [];

    const allFiles: Array<{ entry: JSZip.JSZipObject; type: 'post' | 'image'; targetPath: string; name: string }> = [];

    const rejected: string[] = [];
    zip.forEach((relativePath, entry) => {
      if (entry.dir) return;
      if (relativePath.startsWith('posts/') && relativePath.endsWith('.md')) {
        const name = relativePath.replace(/^posts\//, '');
        if (!isSafeFilename(name)) { rejected.push(relativePath); return; }
        allFiles.push({ entry, type: 'post', targetPath: `src/content/blog/${name}`, name });
      } else if (relativePath.startsWith('uploads/')) {
        const name = relativePath.replace(/^uploads\//, '');
        if (!isSafeFilename(name)) { rejected.push(relativePath); return; }
        allFiles.push({ entry, type: 'image', targetPath: `public/uploads/${name}`, name });
      }
    });

    if (rejected.length > 0) {
      console.warn('[import] rejected unsafe filenames:', rejected);
    }

    if (allFiles.length === 0) {
      return new Response(JSON.stringify({ error: 'Zip não contém posts/ ou uploads/' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Pré-flight: detecta conflitos
    let totalSize = 0;
    for (const f of allFiles) {
      const exists = await repoFileExists(f.targetPath);
      // @ts-ignore - JSZipObject._data tem uncompressedSize
      const size = (f.entry as any)?._data?.uncompressedSize || 0;
      totalSize += size;
      const record = { name: f.name, size, exists };
      if (f.type === 'post') posts.push(record);
      else images.push(record);
    }

    if (mode === 'preview') {
      return new Response(
        JSON.stringify({
          manifest,
          posts,
          images,
          total_size: totalSize,
        } satisfies ImportResult),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mode = apply: grava arquivos respeitando conflictPolicy
    const writeOne = async (f: typeof allFiles[number], record: ImportResult['posts'][number]) => {
      try {
        if (record.exists && conflictPolicy === 'skip') {
          record.status = 'skipped';
          return;
        }
        const isText = f.type === 'post';
        const data = isText ? await f.entry.async('string') : Buffer.from(await f.entry.async('uint8array'));
        await repoWriteFile(f.targetPath, data, {
          message: `MSIA Import: ${f.type === 'post' ? 'post' : 'image'} ${f.name}`,
        });
        record.status = record.exists ? 'overwritten' : 'created';
      } catch (err: any) {
        record.status = 'error';
        record.error = err?.message || 'erro desconhecido';
      }
    };

    // Posts primeiro (texto, rápido), depois imagens
    for (let i = 0; i < allFiles.length; i++) {
      const f = allFiles[i];
      const record = f.type === 'post' ? posts.find((p) => p.name === f.name)! : images.find((p) => p.name === f.name)!;
      await writeOne(f, record);
    }

    return new Response(
      JSON.stringify({
        manifest,
        posts,
        images,
        total_size: totalSize,
        applied: true,
      } satisfies ImportResult & { applied: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[import] erro:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Erro ao importar' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
