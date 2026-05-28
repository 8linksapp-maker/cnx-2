/**
 * Helper compartilhado para chamadas à /api/admin/github
 */
export async function githubApi(action: string, path: string, extra?: Record<string, any>) {
    const res = await fetch('/api/admin/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, path, ...extra })
    });
    if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Erro ${res.status} na API`);
    }
    return res.json();
}

export interface CommitFile {
    path: string;
    content: string | null;
    encoding?: 'utf-8' | 'base64';
}

/**
 * Commita N arquivos num único commit atômico (1 commit, 1 rebuild Vercel).
 * Usar quando uma ação grava mais de um arquivo (ex: post + capa + imagens inline).
 */
export async function atomicCommitApi(files: CommitFile[], message: string) {
    const res = await fetch('/api/admin/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, message }),
    });
    if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Erro ${res.status} na API`);
    }
    return res.json() as Promise<{ success: boolean; sha: string | null }>;
}
