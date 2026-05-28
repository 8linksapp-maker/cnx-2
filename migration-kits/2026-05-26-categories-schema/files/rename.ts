/**
 * API Route: /api/admin/categories/rename
 *
 * POST { oldName, newName, createRedirect?: boolean }
 *
 * - Atualiza categories.json (substitui oldName por newName)
 * - Lista posts em src/content/blog e atualiza `category: "{old}"` → `category: "{new}"`
 * - Opcionalmente cria redirect 301 /categoria/old-slug → /categoria/new-slug
 *
 * Implementação MVP: múltiplos commits (1 por arquivo). Para refatorar pra
 * batch via Git tree API quando virar gargalo (categorias com 50+ posts).
 */
import type { APIRoute } from 'astro';
import { readFileFromRepo, writeFileToRepo } from '../../../../plugins/_server';
import { normalizeCategories, slugifyCategory, type CategoryEntry } from '../../../../lib/categorySlug';
import { buildVercelRedirects } from '../../../../lib/vercelJson';

export const prerender = false;

const CATEGORIES_PATH = 'src/data/categories.json';
const REDIRECTS_PATH = 'src/data/redirects.json';
const VERCEL_JSON_PATH = 'vercel.json';
const BLOG_DIR = 'src/content/blog';

const slugify = slugifyCategory;

async function syncVercelJson(redirects: any[]) {
    try {
        let vercelConfig: any = {};
        const existing = await readFileFromRepo(VERCEL_JSON_PATH);
        if (existing) {
            try { vercelConfig = JSON.parse(existing); } catch {}
        }
        vercelConfig.redirects = buildVercelRedirects(redirects);
        await writeFileToRepo(VERCEL_JSON_PATH, JSON.stringify(vercelConfig, null, 2), {
            message: 'CMS: Sync vercel.json (rename categoria)',
        });
    } catch {}
}

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

        // 1) Atualiza categories.json (suporta legacy string[] e novo {name,slug}[])
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
        categories[idx] = description
            ? { name: newName, slug: newSlug, description }
            : { name: newName, slug: newSlug };
        await writeFileToRepo(CATEGORIES_PATH, JSON.stringify(categories, null, 2), {
            message: `CMS: Renomeando categoria "${oldName}" → "${newName}"`,
        });

        // 2) Lista posts e atualiza os afetados
        const token = process.env.GITHUB_TOKEN || '';
        const owner = process.env.GITHUB_OWNER || '';
        const repo = process.env.GITHUB_REPO || '';
        const listUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${BLOG_DIR}`;
        const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } });
        const listed = listRes.ok ? await listRes.json() : [];

        let postsUpdated = 0;
        const escapedOld = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const oldQuoted = new RegExp(`^(\\s*category:\\s*)["']?${escapedOld}["']?(\\s*)$`, 'm');

        for (const f of Array.isArray(listed) ? listed : []) {
            if (!f.name.endsWith('.md')) continue;
            const content = await readFileFromRepo(f.path);
            if (!content) continue;
            if (!oldQuoted.test(content)) continue;
            const updated = content.replace(oldQuoted, (_m, p1, p2) => `${p1}"${newName}"${p2}`);
            if (updated === content) continue;
            await writeFileToRepo(f.path, updated, {
                message: `CMS: Atualizando categoria de ${f.name} (${oldName} → ${newName})`,
            });
            postsUpdated++;
        }

        // 3) Redirect 301 /categoria/old-slug → /categoria/new-slug
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
                    redirects.push({
                        id: `cat-rename-${Date.now()}`,
                        from,
                        to,
                        type: 301,
                        enabled: true,
                        createdBy: 'category-rename',
                    });
                    await writeFileToRepo(REDIRECTS_PATH, JSON.stringify(redirects, null, 2), {
                        message: `CMS: Redirect 301 ${from} → ${to}`,
                    });
                    await syncVercelJson(redirects);
                    redirectsCreated = 1;
                }
            }
        }

        return new Response(JSON.stringify({
            success: true,
            postsUpdated,
            redirectsCreated,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'erro' }), { status: 500 });
    }
};
