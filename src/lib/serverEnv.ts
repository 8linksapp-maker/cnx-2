/**
 * serverEnv.ts — leitura de credenciais de ambiente em RUNTIME.
 *
 * Por que não usar `import.meta.env.GITHUB_TOKEN` direto:
 * o Vite INLINA `import.meta.env.X` em build-time. Uma env var adicionada
 * no dashboard da Vercel DEPOIS do build fica gravada como `undefined` no
 * bundle — setar a chave e dar "redeploy" (com cache de build) não resolve.
 *
 * `process.env`, numa função serverless Node da Vercel, reflete as env vars
 * do projeto NA HORA da requisição. Por isso lemos process.env primeiro,
 * com fallback pro import.meta.env (que cobre o `bun run dev` local, onde
 * o Astro carrega o .env em import.meta.env).
 *
 * Doc Astro: "With most adapters you can access environment variables with
 * process.env" — https://docs.astro.build/en/guides/environment-variables
 */
export function readGithubEnv() {
    return {
        token: (process.env.GITHUB_TOKEN ?? import.meta.env.GITHUB_TOKEN ?? '').trim(),
        owner: (process.env.GITHUB_OWNER ?? import.meta.env.GITHUB_OWNER ?? '').trim(),
        repo: (process.env.GITHUB_REPO ?? import.meta.env.GITHUB_REPO ?? '').trim(),
    };
}

/** DEPLOY_HOOK_URL — mesmo motivo do readGithubEnv: precisa ser lido em runtime. */
export function readDeployHookUrl(): string {
    return (process.env.DEPLOY_HOOK_URL ?? import.meta.env.DEPLOY_HOOK_URL ?? '').trim();
}

let cachedBranch: string | null = null;

/**
 * Resolve o branch default do repo (main, master, etc.) via GitHub API.
 * Zero config — funciona com qualquer branch. Override opcional via GITHUB_BRANCH.
 * Cacheado em memória (1 repo por deployment; a ref não muda em runtime).
 *
 * Necessário porque a Git Data API (refs/trees/commits, usada no commit
 * atômico) exige branch explícito — diferente da Contents API, que cai no
 * default sozinha. Repos criados com `master` quebravam com 'main' chumbado.
 */
export async function getDefaultBranch(owner: string, repo: string, token: string): Promise<string> {
    const override = (process.env.GITHUB_BRANCH ?? import.meta.env.GITHUB_BRANCH ?? '').trim();
    if (override) return override;
    if (cachedBranch) return cachedBranch;
    try {
        const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
        });
        if (r.ok) {
            const d = await r.json();
            if (d?.default_branch) {
                cachedBranch = d.default_branch as string;
                return cachedBranch;
            }
        }
    } catch {}
    return 'main';
}
