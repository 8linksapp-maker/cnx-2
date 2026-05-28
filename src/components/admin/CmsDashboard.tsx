import React, { useState, useEffect } from 'react';
import { Loader2, FileText, PenLine, Eye, AlertCircle, CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { githubApi } from '../../lib/adminApi';

interface RecentPost {
    title: string;
    slug: string;
    pubDate: string;
    draft: boolean;
    category: string;
}

interface SetupItem {
    id: string;
    label: string;
    done: boolean;
    href: string;
}

export default function CmsDashboard() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
    const [totalPosts, setTotalPosts] = useState(0);
    const [setupItems, setSetupItems] = useState<SetupItem[]>([]);
    const [allSetupDone, setAllSetupDone] = useState(false);

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        setError('');
        try {
            const [postsRes, cfgRes] = await Promise.allSettled([
                githubApi('list', 'src/content/blog'),
                githubApi('read', 'src/data/siteConfig.json'),
            ]);

            // Artigos
            let posts: RecentPost[] = [];
            let total = 0;
            if (postsRes.status === 'fulfilled' && Array.isArray(postsRes.value?.data)) {
                const mds = postsRes.value.data.filter((f: any) => f.name.endsWith('.md'));
                total = mds.length;
                const previews = await Promise.all(
                    mds.slice(0, 8).map(async (f: any) => {
                        try {
                            const d = await githubApi('read', f.path);
                            const text = d.content || '';
                            const fm = text.match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
                            const get = (k: string) => fm.match(new RegExp(`${k}:\\s*(?:"([^"]*)"|([^\\n]+))`))?.[1] || fm.match(new RegExp(`${k}:\\s*(?:"([^"]*)"|([^\\n]+))`))?.[2] || '';
                            return {
                                title: get('title') || f.name.replace('.md', ''),
                                slug: f.name.replace('.md', ''),
                                pubDate: get('pubDate'),
                                draft: get('draft') === 'true',
                                category: get('category'),
                            };
                        } catch { return null; }
                    })
                );
                posts = previews.filter(Boolean).slice(0, 5) as RecentPost[];
            }
            setRecentPosts(posts);
            setTotalPosts(total);

            // Checklist de setup
            let cfg: any = {};
            if (cfgRes.status === 'fulfilled') {
                try { cfg = JSON.parse(cfgRes.value?.content || '{}'); } catch {}
            }
            const items: SetupItem[] = [
                {
                    id: 'name',
                    label: 'Escolher nome e aparência do blog',
                    done: !!(cfg.name && cfg.name !== 'Meu Blog' && cfg.name !== 'MSIA Scaffold'),
                    href: '/admin/config',
                },
                {
                    id: 'post',
                    label: 'Publicar o primeiro artigo',
                    done: total > 0,
                    href: '/admin/posts/new',
                },
                {
                    id: 'sobre',
                    label: 'Preencher a página Sobre',
                    done: !!(cfg.description && cfg.description.length > 20),
                    href: '/admin/sobre',
                },
                {
                    id: 'domain',
                    label: 'Configurar domínio próprio',
                    done: !!(cfg.url && !cfg.url.includes('vercel.app') && cfg.url !== 'https://exemplo.com'),
                    href: '/admin/config',
                },
            ];
            setSetupItems(items);
            setAllSetupDone(items.every(i => i.done));
        } catch (e: any) {
            setError('Não foi possível carregar os dados. Verifique a conexão com o repositório.');
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-ink-faint">
                <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden="true" />
                <p className="text-sm">Carregando seu blog...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div role="alert" className="flex items-start gap-3 p-5 bg-red-50 border border-red-200 rounded-md text-red-700">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                    <p className="font-semibold text-sm">{error}</p>
                    <button onClick={load} className="mt-2 text-sm underline underline-offset-2 hover:no-underline">
                        Tentar novamente
                    </button>
                </div>
            </div>
        );
    }

    const setupDoneCount = setupItems.filter(i => i.done).length;

    return (
        <div className="space-y-8 max-w-3xl">

            {/* Ação primária */}
            <div className="flex flex-col sm:flex-row gap-3">
                <a
                    href="/admin/posts/new"
                    className="flex-1 flex items-center justify-center gap-2 bg-primary hover:brightness-90 text-surface rounded-md px-6 py-4 font-semibold transition-all"
                    style={{ boxShadow: '0 2px 8px rgba(80,40,20,0.14)' }}
                >
                    <PenLine className="w-5 h-5" aria-hidden="true" />
                    Escrever novo artigo
                </a>
                <a
                    href="/admin/posts"
                    className="flex-1 flex items-center justify-center gap-2 bg-surface border border-border hover:border-primary/40 hover:bg-elev text-ink rounded-md px-6 py-4 font-semibold transition-colors"
                >
                    <FileText className="w-5 h-5" aria-hidden="true" />
                    Ver todos os artigos
                    {totalPosts > 0 && (
                        <span className="ml-1 text-xs font-bold text-ink-faint tabular-nums">({totalPosts})</span>
                    )}
                </a>
            </div>

            {/* Checklist de setup — persiste até completar todos */}
            {!allSetupDone && (
                <section aria-labelledby="setup-heading">
                    <div className="flex items-center justify-between mb-3">
                        <h2 id="setup-heading" className="text-sm font-semibold text-ink">
                            Configure seu blog
                        </h2>
                        <span className="text-xs font-bold text-ink-faint tabular-nums">
                            {setupDoneCount}/{setupItems.length} concluídos
                        </span>
                    </div>
                    <div className="bg-surface border border-border rounded-md overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(80,40,20,0.04)' }}>
                        {/* Barra de progresso */}
                        <div className="h-1 bg-elev" role="progressbar" aria-valuenow={setupDoneCount} aria-valuemin={0} aria-valuemax={setupItems.length} aria-label={`${setupDoneCount} de ${setupItems.length} itens de configuração concluídos`}>
                            <div
                                className="h-full bg-primary transition-all duration-500"
                                style={{ width: `${(setupDoneCount / setupItems.length) * 100}%` }}
                            />
                        </div>
                        <ul className="divide-y divide-border">
                            {setupItems.map(item => (
                                <li key={item.id}>
                                    <a
                                        href={item.done ? undefined : item.href}
                                        aria-disabled={item.done}
                                        className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
                                            item.done
                                                ? 'cursor-default'
                                                : 'hover:bg-elev group'
                                        }`}
                                    >
                                        {item.done ? (
                                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" aria-hidden="true" />
                                        ) : (
                                            <Circle className="w-4 h-4 text-ink-faint shrink-0 group-hover:text-primary transition-colors" aria-hidden="true" />
                                        )}
                                        <span className={`text-sm flex-1 ${item.done ? 'line-through text-ink-faint' : 'text-ink font-medium'}`}>
                                            {item.label}
                                        </span>
                                        {!item.done && (
                                            <span className="text-xs text-primary font-semibold group-hover:underline shrink-0">
                                                Configurar
                                            </span>
                                        )}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            )}

            {/* Artigos recentes */}
            {recentPosts.length > 0 && (
                <section aria-labelledby="recent-heading">
                    <div className="flex items-center justify-between mb-3">
                        <h2 id="recent-heading" className="text-sm font-semibold text-ink">Artigos recentes</h2>
                        <a href="/admin/posts" className="text-xs text-primary hover:underline font-semibold">
                            Ver todos
                        </a>
                    </div>
                    <div className="bg-surface border border-border rounded-md overflow-hidden divide-y divide-border" style={{ boxShadow: '0 1px 2px rgba(80,40,20,0.04)' }}>
                        {recentPosts.map(post => (
                            <div key={post.slug} className="flex items-center gap-3 px-5 py-3.5">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-ink truncate">{post.title}</p>
                                    {post.category && (
                                        <p className="text-xs text-ink-faint mt-0.5 font-mono">{post.category}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                                        post.draft
                                            ? 'bg-elev text-ink-faint'
                                            : 'bg-green-50 text-green-700 border border-green-200'
                                    }`}>
                                        {post.draft ? 'Rascunho' : 'Publicado'}
                                    </span>
                                    <a
                                        href={`/admin/posts/edit?file=src/content/blog/${post.slug}.md`}
                                        aria-label={`Editar artigo: ${post.title}`}
                                        className="p-1.5 text-ink-faint hover:text-primary transition-colors"
                                    >
                                        <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                                    </a>
                                    {!post.draft && (
                                        <a
                                            href={`/${post.slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={`Ver artigo no site: ${post.title}`}
                                            className="p-1.5 text-ink-faint hover:text-primary transition-colors"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Empty state — primeiro uso */}
            {recentPosts.length === 0 && !loading && (
                <section className="text-center py-12 bg-surface border border-dashed border-border rounded-md">
                    <FileText className="w-10 h-10 text-ink-faint mx-auto mb-3" aria-hidden="true" />
                    <h2 className="text-base font-semibold text-ink mb-1">Seu blog está pronto</h2>
                    <p className="text-sm text-ink-muted mb-5 max-w-xs mx-auto">
                        Escreva o primeiro artigo e comece a publicar conteúdo.
                    </p>
                    <a
                        href="/admin/posts/new"
                        className="inline-flex items-center gap-2 bg-primary hover:brightness-90 text-surface px-6 py-2.5 rounded font-semibold text-sm transition-all"
                    >
                        <PenLine className="w-4 h-4" aria-hidden="true" />
                        Escrever primeiro artigo
                    </a>
                </section>
            )}

            {/* Stats — secundário, só quando há conteúdo */}
            {totalPosts > 0 && (
                <section aria-labelledby="stats-heading">
                    <h2 id="stats-heading" className="text-[10px] font-bold text-ink-faint uppercase tracking-widest mb-3">Resumo</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Total de artigos', value: totalPosts },
                            { label: 'Publicados', value: recentPosts.filter(p => !p.draft).length },
                            { label: 'Rascunhos', value: recentPosts.filter(p => p.draft).length },
                        ].map(({ label, value }) => (
                            <div key={label} className="bg-surface border border-border rounded-md px-4 py-3" style={{ boxShadow: '0 1px 2px rgba(80,40,20,0.04)' }}>
                                <p className="text-xs text-ink-faint mb-1">{label}</p>
                                <p className="text-2xl font-bold text-ink tabular-nums leading-none">{value}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
