/**
 * api/admin/local/pexels-image.ts — busca imagens no Pexels pros serviços.
 *
 * POST { queries: string[] }  → { urls: string[] }  (mesma ordem; '' quando não acha)
 * POST { query: string }      → { url: string }
 *
 * Usa a pexelsApiKey do pluginsConfig (mesma do gerador de posts). Sem chave →
 * urls vazias (o serviço fica com cor+ícone). Hotlink da URL do Pexels (landscape).
 */
import type { APIRoute } from 'astro';
import { validateSession } from '../../../../lib/auth';
import { loadAISettings } from '../../../../plugins/ai-generator/ai-provider';
import { searchPexelsPhotos, getThumbnailUrl } from '../../../../plugins/ai-generator/pexels';

export const prerender = false;

function parseCookies(header: string): Record<string, string> {
  return Object.fromEntries(header.split(';').map((c) => {
    const [k, ...v] = c.trim().split('=');
    return [k, decodeURIComponent(v.join('='))];
  }));
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const cookies = parseCookies(request.headers.get('cookie') || '');
    if (!(await validateSession(cookies['admin_session']))) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const single = typeof body?.query === 'string';
    const queries: string[] = single ? [body.query] : (Array.isArray(body?.queries) ? body.queries : []);
    if (!queries.length) {
      return new Response(JSON.stringify({ error: 'Informe ao menos uma busca.' }), { status: 400 });
    }

    const key = loadAISettings().pexelsApiKey || '';
    if (!key.trim()) {
      const empty = queries.map(() => '');
      return new Response(JSON.stringify(single ? { url: '' } : { urls: empty, noKey: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Busca em paralelo (até 20 pra não estourar rate limit).
    const limited = queries.slice(0, 20);
    const urls = await Promise.all(limited.map(async (q) => {
      try {
        const photos = await searchPexelsPhotos(key, String(q || '').trim(), 3);
        return photos[0] ? getThumbnailUrl(photos[0]) : '';
      } catch { return ''; }
    }));

    return new Response(JSON.stringify(single ? { url: urls[0] || '' } : { urls }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Erro ao buscar imagens.' }), { status: 500 });
  }
};
