/**
 * api/admin/repo-visibility.ts — Diz se o repo do blog está público.
 *
 * GET → { configured: boolean, private: boolean | null }
 *   - configured=false: dev ou sem GITHUB_* → não dá pra checar (não mostra aviso)
 *   - private=false: repo PÚBLICO → secrets em pluginsConfig.json expostos → aviso no admin
 *
 * Protegido pelo middleware (sessão admin). Cache de 5min pra não gastar
 * rate limit do GitHub a cada page load do dashboard.
 */
import type { APIRoute } from 'astro';

export const prerender = false;

let cache: { isPrivate: boolean | null; at: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export const GET: APIRoute = async () => {
    const json = (data: unknown) =>
        new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const token = (import.meta.env.GITHUB_TOKEN ?? '').trim();
    const owner = (import.meta.env.GITHUB_OWNER ?? '').trim();
    const repo = (import.meta.env.GITHUB_REPO ?? '').trim();

    // Dev / sem credenciais → não há repo remoto pra checar
    if (!token || !owner || !repo) return json({ configured: false, private: null });

    if (cache && Date.now() - cache.at < CACHE_MS) {
        return json({ configured: true, private: cache.isPrivate });
    }

    try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
        });
        if (!res.ok) return json({ configured: false, private: null });
        const data = await res.json();
        const isPrivate = data?.private === true;
        cache = { isPrivate, at: Date.now() };
        return json({ configured: true, private: isPrivate });
    } catch {
        return json({ configured: false, private: null });
    }
};
