import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, Loader2, Trash2, Edit3, AlertCircle, Save, ChevronUp, ChevronDown, Check, X, AlertTriangle, ExternalLink } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';
import { normalizeCategories } from '../../lib/categorySlug';

export default function PostsManager() {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [authors, setAuthors] = useState<any[]>([]);
    const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
    const [editingSha, setEditingSha] = useState<string | null>(null);
    const [quickEditData, setQuickEditData] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [sortField, setSortField] = useState<'title' | 'pubDate'>('pubDate');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
    const [pendingDelete, setPendingDelete] = useState<{ path: string; sha: string; name: string } | null>(null);
    const [quickEditError, setQuickEditError] = useState('');
    const itemsPerPage = 20;

    useEffect(() => { fetchInitialData(); }, []);
    useEffect(() => { setCurrentPage(1); }, [search, statusFilter, categoryFilter, sortField, sortOrder]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            let allCategories = new Set<string>();

            const [authRes, catRes, postsRes] = await Promise.allSettled([
                githubApi('read', 'src/data/authors.json'),
                githubApi('read', 'src/data/categories.json'),
                githubApi('list', 'src/content/blog'),
            ]);

            if (authRes.status === 'fulfilled' && authRes.value?.content) {
                try {
                    const parsed = JSON.parse(authRes.value?.content || "{}");
                    if (Array.isArray(parsed)) setAuthors(parsed);
                } catch {}
            }

            if (catRes.status === 'fulfilled' && catRes.value?.content) {
                try {
                    const parsedCats = JSON.parse(catRes.value?.content || "[]");
                    // Schema novo {name,slug}[] OU legacy string[] — só pegamos os names
                    normalizeCategories(parsedCats).forEach((c) => allCategories.add(c.name));
                } catch {}
            }

            if (postsRes.status === 'fulfilled') {
                const data = postsRes.value;
                const mdFiles = Array.isArray(data.data) ? data.data.filter((f: any) => f.name.endsWith('.md')) : [];

                const enriched: any[] = [];
                await Promise.all(mdFiles.map(async (f: any) => {
                    const fileData = await githubApi('read', f.path).catch(() => null);
                    if (!fileData) return;
                    const text = fileData.content || '';
                    const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
                    let title = f.name, category = 'Geral', author = '', pubDate = '', draft = false, description = '', heroImage = '';
                    const slug = f.name.replace('.md', '');
                    if (match) {
                        const fm = match[1];
                        const extract = (key: string) => { const m = fm.match(new RegExp(`${key}:\\s*(?:"([^"]*)"|'([^']*)'|([^\\n\\r]+))`)); return m ? (m[1] || m[2] || m[3] || '').trim() : ''; };
                        title = extract('title') || f.name; category = extract('category') || 'Geral'; author = extract('author'); pubDate = extract('pubDate'); draft = extract('draft') === 'true'; description = extract('description'); heroImage = extract('heroImage');
                        if (category) allCategories.add(category);
                    }
                    enriched.push({ ...f, sha: fileData.sha || f.sha, title, category, author, pubDate, draft, description, heroImage, slug, rawBody: match ? match[2] : text });
                }));

                setPosts(enriched);
                if (allCategories.size > 0) setDynamicCategories(Array.from(allCategories));
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (path: string, sha: string, name: string) => {
        setPendingDelete({ path, sha, name });
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        const { path, sha, name } = pendingDelete;
        setPendingDelete(null);
        try {
            await githubApi('delete', path, { sha, message: `CMS: Excluindo post ${name}` });
            setPosts(posts.filter(f => f.sha !== sha));
            triggerToast(`Artigo "${name}" excluído.`, 'success');
        } catch (err: any) {
            triggerToast(`Não foi possível excluir "${name}". Verifique sua conexão e tente novamente.`, 'error');
        }
    };

    const handleQuickAction = (post: any) => {
        setEditingSha(post.sha);
        setQuickEditData({ title: post.title, slug: post.slug, pubDate: post.pubDate ? new Date(post.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0], author: post.author, category: post.category, draft: post.draft, _oldSlug: post.slug, _oldPath: post.path, _sha: post.sha, description: post.description, heroImage: post.heroImage, rawBody: post.rawBody });
    };

    /**
     * Cria redirect 301 automatico /slug-antigo → /slug-novo via plugin redirects.
     * Lê siteConfig pra respeitar postUrlPrefix (URL pode ser /slug ou /blog/slug).
     * Falha silenciosamente se o plugin redirects nao estiver disponivel — o rename
     * do arquivo eh mais critico que o redirect.
     */
    const createSlugRedirect = async (oldSlug: string, newSlug: string) => {
        try {
            const cfgRes = await githubApi('read', 'src/data/siteConfig.json').catch(() => null);
            const cfg = cfgRes?.content ? JSON.parse(cfgRes.content) : {};
            const prefix = String(cfg.postUrlPrefix || '').replace(/^\/+|\/+$/g, '');
            const oldUrl = prefix ? `/${prefix}/${oldSlug}` : `/${oldSlug}`;
            const newUrl = prefix ? `/${prefix}/${newSlug}` : `/${newSlug}`;

            const listRes = await fetch('/api/admin/plugins/redirects');
            const list: any[] = listRes.ok ? await listRes.json() : [];
            if (list.some(r => r.from === oldUrl)) return; // já existe

            const updated = [...list, {
                id: `slug-rename-${Date.now()}`,
                from: oldUrl,
                to: newUrl,
                type: 301,
                enabled: true,
                createdBy: 'slug-rename',
            }];
            await fetch('/api/admin/plugins/redirects', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated),
            });
        } catch (e) {
            // Redirect 301 não é crítico — o artigo foi salvo. Avisamos sem bloquear.
            triggerToast('Artigo salvo. Redirecionamento da URL antiga não foi criado automaticamente.', 'info');
        }
    };

    const saveQuickEdit = async () => {
        setQuickEditError('');
        if (!quickEditData.title || !quickEditData.slug) {
            setQuickEditError('Preencha o título e a URL do artigo. Ambos são obrigatórios.');
            return;
        }
        if (quickEditData.slug !== quickEditData._oldSlug && posts.some(p => p.slug === quickEditData.slug && p.sha !== quickEditData._sha)) {
            setQuickEditError('Essa URL já está em uso por outro artigo. Escolha uma diferente.');
            return;
        }
        setSaving(true);
        try {
            const targetPath = `src/content/blog/${quickEditData.slug}.md`;
            const markdown = `---\ntitle: "${quickEditData.title.replace(/"/g, '\\"')}"\ndescription: "${(quickEditData.description || '').replace(/"/g, '\\"')}"\npubDate: "${quickEditData.pubDate}"\nheroImage: "${quickEditData.heroImage || ''}"\ncategory: "${quickEditData.category}"\nauthor: "${quickEditData.author}"\ndraft: ${quickEditData.draft}\n---\n${quickEditData.rawBody}`;

            if (quickEditData.slug !== quickEditData._oldSlug) {
                await githubApi('write', targetPath, { content: markdown, message: `CMS: Renomeando ${quickEditData.slug}` });
                await githubApi('delete', quickEditData._oldPath, { sha: quickEditData._sha, message: 'CMS: Apagando slug antigo' });
                // Cria redirect 301 automaticamente pra preservar SEO/backlinks
                await createSlugRedirect(quickEditData._oldSlug, quickEditData.slug);
                triggerToast(`Artigo renomeado para "${quickEditData.slug}" — redirect 301 criado automaticamente.`, 'success');
            } else {
                await githubApi('write', targetPath, { content: markdown, sha: quickEditData._sha, message: `CMS: Edição Rápida ${quickEditData.slug}` });
                triggerToast('Artigo atualizado com sucesso!', 'success');
            }
            setEditingSha(null);
            fetchInitialData();
        } catch (e: any) {
            triggerToast(`Erro: ${e.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    // Filtering & sorting
    let filtered = posts.filter(p => {
        if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.slug.toLowerCase().includes(search.toLowerCase())) return false;
        if (statusFilter === 'published' && p.draft) return false;
        if (statusFilter === 'draft' && !p.draft) return false;
        if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
        return true;
    });
    filtered = [...filtered].sort((a, b) => {
        const aVal = sortField === 'pubDate' ? new Date(a.pubDate || 0).getTime() : (a.title || '').toLowerCase();
        const bVal = sortField === 'pubDate' ? new Date(b.pubDate || 0).getTime() : (b.title || '').toLowerCase();
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const toggleSort = (field: 'title' | 'pubDate') => {
        if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortOrder('asc'); }
    };

    const SortIcon = ({ field }: { field: 'title' | 'pubDate' }) => {
        if (sortField !== field) return null;
        return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />;
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-3xl border border-border">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p className="font-medium animate-pulse">Carregando artigos...</p>
        </div>
    );

    return (
        <div className="space-y-6 pb-32">

            {/* Confirmação de exclusão — inline, sem confirm() nativo */}
            {pendingDelete && (
                <div role="alert" className="flex items-center gap-4 bg-red-50 border border-red-200 rounded-md px-5 py-4">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" aria-hidden="true" />
                    <p className="text-sm text-red-800 font-medium flex-1">
                        Excluir <strong>"{pendingDelete.name}"</strong>? Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={() => setPendingDelete(null)}
                            className="px-4 py-2 min-h-[40px] text-sm font-semibold text-red-700 hover:bg-red-100 rounded transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={confirmDelete}
                            className="px-4 py-2 min-h-[40px] text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                        >
                            Sim, excluir
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface p-5 px-6 rounded-lg border border-border shadow-sm sticky top-0 z-40">
                <div>
                    <h2 className="text-lg font-bold text-ink">Artigos do Blog</h2>
                    <p className="text-xs font-bold text-ink-muted uppercase tracking-widest mt-1">{posts.length} artigos no total</p>
                </div>
                <a href="/admin/posts/new" className="bg-primary hover:bg-primary text-white px-6 py-3 rounded-md font-bold flex items-center gap-2 shadow-lg shadow-none/25 hover:-translate-y-0.5 transition-all">
                    <Plus className="w-5 h-5" /> Novo Artigo
                </a>
            </div>

            {error && <div role="alert" className="p-5 bg-red-100/50 text-red-700 rounded-lg font-bold border border-red-200"><AlertCircle className="w-5 h-5 inline mr-2 -mt-1" aria-hidden="true" /> {error}</div>}

            {/* Filters */}
            <div className="bg-surface p-4 rounded-lg border border-border shadow-sm flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                    <input type="text" aria-label="Buscar artigos" placeholder="Buscar artigos..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-elev border border-border rounded-md text-sm focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/20" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-elev border border-border rounded-md px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-primary/80">
                    <option value="all">Todos</option>
                    <option value="published">Publicados</option>
                    <option value="draft">Rascunhos</option>
                </select>
                {dynamicCategories.length > 0 && (
                    <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-elev border border-border rounded-md px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-primary/80">
                        <option value="all">Todas as categorias</option>
                        {dynamicCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                )}
            </div>

            {/* Table */}
            {paginated.length === 0 ? (
                <div className="bg-surface border-2 border-dashed border-border rounded-lg p-16 flex flex-col items-center justify-center text-center">
                    <FileText className="w-10 h-10 text-ink-faint mb-4" aria-hidden="true" />
                    {search || statusFilter !== 'all' || categoryFilter !== 'all' ? (
                        <>
                            <h3 className="text-base font-semibold text-ink mb-2">Nenhum artigo encontrado</h3>
                            <p className="text-sm text-ink-muted mb-5">Tente ajustar os filtros ou a busca.</p>
                            <button
                                onClick={() => { setSearch(''); setStatusFilter('all'); setCategoryFilter('all'); }}
                                className="text-sm font-semibold text-primary hover:underline"
                            >
                                Limpar filtros
                            </button>
                        </>
                    ) : (
                        <>
                            <h3 className="text-base font-semibold text-ink mb-2">Nenhum artigo ainda</h3>
                            <p className="text-sm text-ink-muted mb-5 max-w-xs">Escreva o primeiro artigo para começar a publicar conteúdo no seu blog.</p>
                            <a href="/admin/posts/new" className="inline-flex items-center gap-2 bg-primary hover:brightness-90 text-surface font-semibold px-6 py-2.5 rounded text-sm transition-all">
                                Escrever primeiro artigo
                            </a>
                        </>
                    )}
                </div>
            ) : (
                <div className="bg-surface rounded-lg border border-border overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="border-b border-border bg-elev">
                                <tr>
                                    <th scope="col" className="py-4 px-4 w-8"><input type="checkbox" aria-label="Selecionar todos os artigos da página" className="rounded" onChange={e => setSelectedPosts(e.target.checked ? paginated.map(p => p.sha) : [])} checked={selectedPosts.length === paginated.length && paginated.length > 0} /></th>
                                    <th scope="col" aria-sort={sortField === 'title' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'} className="py-4 px-4 text-xs font-bold text-ink-muted uppercase tracking-wider cursor-pointer hover:text-ink" onClick={() => toggleSort('title')}>Título <SortIcon field="title" /></th>
                                    <th scope="col" className="py-4 px-4 text-xs font-bold text-ink-muted uppercase tracking-wider hidden sm:table-cell">Categoria</th>
                                    <th scope="col" className="py-4 px-4 text-xs font-bold text-ink-muted uppercase tracking-wider hidden md:table-cell">Autor</th>
                                    <th scope="col" aria-sort={sortField === 'pubDate' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'} className="py-4 px-4 text-xs font-bold text-ink-muted uppercase tracking-wider cursor-pointer hover:text-ink hidden md:table-cell" onClick={() => toggleSort('pubDate')}>Data <SortIcon field="pubDate" /></th>
                                    <th scope="col" className="py-4 px-4 text-xs font-bold text-ink-muted uppercase tracking-wider">Status</th>
                                    <th scope="col" className="py-4 px-4 text-xs font-bold text-ink-muted uppercase tracking-wider text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {paginated.map(post => (
                                    <React.Fragment key={post.sha}>
                                        <tr className="hover:bg-elev transition-colors">
                                            <td className="py-4 px-4"><input type="checkbox" aria-label={`Selecionar artigo: ${post.title}`} className="rounded" checked={selectedPosts.includes(post.sha)} onChange={e => setSelectedPosts(e.target.checked ? [...selectedPosts, post.sha] : selectedPosts.filter(s => s !== post.sha))} /></td>
                                            <td className="py-4 px-4">
                                                <p className="font-bold text-ink text-sm line-clamp-1">{post.title}</p>
                                                <p className="text-xs text-ink-faint font-mono mt-0.5">/{post.slug}</p>
                                            </td>
                                            <td className="py-4 px-4 hidden sm:table-cell"><span className="text-xs font-bold bg-elev text-ink-muted px-2 py-1 rounded-full">{post.category}</span></td>
                                            <td className="py-4 px-4 hidden md:table-cell text-sm text-ink-muted">{post.author || '—'}</td>
                                            <td className="py-4 px-4 hidden md:table-cell text-xs text-ink-faint font-mono">{post.pubDate || '—'}</td>
                                            <td className="py-4 px-4">
                                                {post.draft ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 px-2 py-1 rounded-full">Rascunho</span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold bg-green-50 text-green-600 border border-green-200 px-2 py-1 rounded-full"><Check className="w-3 h-3" />Publicado</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {!post.draft && (
                                                        <a
                                                            href={`/${post.slug}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            aria-label={`Abrir artigo no site: ${post.title}`}
                                                            title="Abrir no site"
                                                            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-faint hover:text-primary hover:bg-primary-soft rounded transition-colors"
                                                        >
                                                            <ExternalLink className="w-4 h-4" aria-hidden="true" />
                                                        </a>
                                                    )}
                                                    <button
                                                        onClick={() => handleQuickAction(post)}
                                                        aria-label={`Edição rápida: ${post.title}`}
                                                        aria-expanded={editingSha === post.sha}
                                                        title="Edição rápida"
                                                        className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-faint hover:text-primary hover:bg-primary-soft rounded transition-colors"
                                                    >
                                                        <Edit3 className="w-4 h-4" aria-hidden="true" />
                                                    </button>
                                                    <a
                                                        href={`/admin/posts/edit?file=${encodeURIComponent(post.path)}`}
                                                        aria-label={`Editar artigo completo: ${post.title}`}
                                                        title="Editar completo"
                                                        className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-faint hover:text-ink-muted hover:bg-elev rounded transition-colors"
                                                    >
                                                        <FileText className="w-4 h-4" aria-hidden="true" />
                                                    </a>
                                                    <button
                                                        onClick={() => handleDelete(post.path, post.sha, post.title)}
                                                        aria-label={`Excluir artigo: ${post.title}`}
                                                        title="Excluir"
                                                        className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-faint hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Quick Edit Row */}
                                        {editingSha === post.sha && quickEditData && (
                                            <tr className="bg-primary-soft">
                                                <td colSpan={7} className="px-4 py-4">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-1">Título</label>
                                                            <input type="text" value={quickEditData.title} onChange={e => setQuickEditData({ ...quickEditData, title: e.target.value })} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/80" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-1">URL do artigo</label>
                                                            <input type="text" value={quickEditData.slug} onChange={e => setQuickEditData({ ...quickEditData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/80" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-1">Data</label>
                                                            <input type="date" value={quickEditData.pubDate} onChange={e => setQuickEditData({ ...quickEditData, pubDate: e.target.value })} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/80" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-1">Categoria</label>
                                                            <input type="text" list="cats-list" value={quickEditData.category} onChange={e => setQuickEditData({ ...quickEditData, category: e.target.value })} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/80" />
                                                            <datalist id="cats-list">{dynamicCategories.map(c => <option key={c} value={c} />)}</datalist>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-wider mb-1">Autor</label>
                                                            <input type="text" list="authors-list" value={quickEditData.author} onChange={e => setQuickEditData({ ...quickEditData, author: e.target.value })} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/80" />
                                                            <datalist id="authors-list">{authors.map(a => <option key={a.id} value={a.name} />)}</datalist>
                                                        </div>
                                                        <div className="flex items-end gap-3">
                                                            <label className="flex items-center gap-2 text-sm font-bold text-ink-muted cursor-pointer">
                                                                <input type="checkbox" checked={quickEditData.draft} onChange={e => setQuickEditData({ ...quickEditData, draft: e.target.checked })} className="rounded" />
                                                                Rascunho
                                                            </label>
                                                        </div>
                                                    </div>
                                                    {quickEditError && (
                                                        <p role="alert" className="mt-3 text-sm text-red-700 font-medium flex items-center gap-1.5">
                                                            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                                                            {quickEditError}
                                                        </p>
                                                    )}
                                                    <div className="flex gap-3 mt-4 justify-end">
                                                        <button onClick={() => { setEditingSha(null); setQuickEditError(''); }} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-ink-muted hover:bg-elev rounded-lg transition-colors"><X className="w-4 h-4" aria-hidden="true" />Cancelar</button>
                                                        <button onClick={saveQuickEdit} disabled={saving} className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold bg-primary hover:bg-primary text-white rounded-lg shadow-sm transition-all disabled:opacity-60">
                                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                            {saving ? 'Salvando...' : 'Salvar'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => setCurrentPage(p)} aria-label={`Página ${p}`} aria-current={currentPage === p ? 'page' : undefined} className={`w-11 h-11 rounded text-sm font-semibold transition-all ${currentPage === p ? 'bg-primary text-surface' : 'bg-surface border border-border text-ink-muted hover:border-primary/40'}`}>{p}</button>
                    ))}
                </div>
            )}
        </div>
    );
}
