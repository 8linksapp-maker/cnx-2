/**
 * API Route: /api/admin/plugins/redirects
 *
 * GET  — lê src/data/redirects.json
 * PUT  — escreve src/data/redirects.json + sincroniza vercel.json
 */
import type { APIRoute } from 'astro';
import { readDataFile, writeFileToRepo, readFileFromRepo } from '../../../../../plugins/_server';
import { sanitizeRedirects, buildVercelRedirects } from '../../../../../lib/vercelJson';

export const prerender = false;

const REDIRECTS_PATH = 'src/data/redirects.json';
const VERCEL_JSON_PATH = 'vercel.json';

/** Sincroniza redirects ativos pro vercel.json (funciona em static mode) */
async function syncVercelJson(redirects: any[]) {
    try {
        let vercelConfig: any = {};
        const existing = await readFileFromRepo(VERCEL_JSON_PATH);
        if (existing) {
            try { vercelConfig = JSON.parse(existing); } catch {}
        }

        vercelConfig.redirects = buildVercelRedirects(redirects);

        await writeFileToRepo(VERCEL_JSON_PATH, JSON.stringify(vercelConfig, null, 2), {
            message: 'CMS: Sync redirects to vercel.json',
        });
    } catch {}
}

export const GET: APIRoute = async () => {
    try {
        const redirects = readDataFile<any[]>(REDIRECTS_PATH.split('/').pop()!, []);
        return new Response(JSON.stringify(redirects), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};

export const PUT: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const sanitized = sanitizeRedirects(Array.isArray(body) ? body : []);
        const ok = await writeFileToRepo(REDIRECTS_PATH, JSON.stringify(sanitized, null, 2), {
            message: 'CMS: Update redirects',
        });
        if (!ok) return new Response(JSON.stringify({ error: 'Falha ao salvar' }), { status: 500 });

        // Sync to vercel.json for static mode compatibility
        await syncVercelJson(sanitized);

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 400 });
    }
};
