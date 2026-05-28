import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Loader2, Plus, Trash2, Tag, X, Edit2, Package } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';
import { normalizeCategories, slugifyCategory, type CategoryEntry } from '../../lib/categorySlug';

export default function CategoriesEditor() {
    const [categories, setCategories] = useState<CategoryEntry[]>([]);
    const [fileSha, setFileSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [tempName, setTempName] = useState('');
    const [tempSlug, setTempSlug] = useState('');
    const [slugTouched, setSlugTouched] = useState(false);
    const [tempDesc, setTempDesc] = useState('');
    const [modalError, setModalError] = useState('');

    useEffect(() => {
        githubApi('read', 'src/data/categories.json')
            .then(data => {
                const parsed = JSON.parse(data?.content || "[]");
                setCategories(normalizeCategories(parsed));
                setFileSha(data.sha);
            })
            .catch(err => {
                if (err.message.includes('404')) setCategories([]);
                else setError(err.message);
            })
            .finally(() => setLoading(false));
    }, []);

    const openCreate = () => {
        setTempName('');
        setTempSlug('');
        setTempDesc('');
        setSlugTouched(false);
        setEditingIndex(null);
        setIsModalOpen(true);
    };
    const openEdit = (idx: number) => {
        const c = categories[idx];
        setTempName(c.name);
        setTempSlug(c.slug);
        setTempDesc(c.description || '');
        setSlugTouched(true); // slug existente: assume editado manualmente
        setEditingIndex(idx);
        setIsModalOpen(true);
    };
    const modalRef = useRef<HTMLDivElement>(null);
    const closeModal = () => { setIsModalOpen(false); setModalError(''); };

    // Focus trap + ESC para o modal
    useEffect(() => {
        if (!isModalOpen) return;
        const modal = modalRef.current;
        if (!modal) return;
        const focusable = Array.from(modal.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(el => !el.hasAttribute('disabled'));
        focusable[0]?.focus();
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { closeModal(); return; }
            if (e.key !== 'Tab') return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isModalOpen]);

    // Auto-slug quando o usuário ainda não tocou no campo de slug
    const handleNameChange = (value: string) => {
        setTempName(value);
        if (!slugTouched) setTempSlug(slugifyCategory(value));
    };
    const handleSlugChange = (value: string) => {
        setSlugTouched(true);
        // Limpa o input pra slug-safe
        setTempSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'));
    };

    const saveCategoriesArray = async (newList: CategoryEntry[]) => {
        setSaving(true);
        setError('');
        triggerToast('Sincronizando categorias...', 'progress', 20);
        try {
            const data = await githubApi('write', 'src/data/categories.json', {
                content: JSON.stringify(newList, null, 2),
                sha: fileSha || undefined,
                message: 'CMS: Update categories.json'
            });
            setFileSha(data.sha);
            triggerToast('Categorias atualizadas!', 'success', 100);
        } catch (err: any) {
            setError('Não foi possível salvar as categorias. Verifique sua conexão.');
            triggerToast('Não foi possível salvar as categorias. Verifique sua conexão e tente novamente.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const saveModalCategory = async () => {
        setModalError('');
        const name = tempName.trim();
        const slug = (tempSlug.trim() || slugifyCategory(name)).replace(/^-|-$/g, '');
        const description = tempDesc.trim();

        if (!name) { setModalError('Digite o nome da categoria.'); return; }
        if (!slug) { setModalError('A URL da categoria é obrigatória.'); return; }

        const collision = categories.find((c, i) => i !== editingIndex && (c.name === name || c.slug === slug));
        if (collision) {
            setModalError(`"${collision.name}" já existe. Escolha um nome ou URL diferente.`);
            return;
        }

        // Nova categoria
        if (editingIndex === null) {
            const entry: CategoryEntry = description ? { name, slug, description } : { name, slug };
            const arr = [...categories, entry];
            setCategories(arr);
            closeModal();
            await saveCategoriesArray(arr);
            return;
        }

        // Edição
        const old = categories[editingIndex];
        const sameName = old.name === name;
        const sameSlug = old.slug === slug;
        if (sameName && sameSlug && (old.description || '') === description) {
            closeModal();
            return;
        }

        // Se mudou só descrição/slug (mesmo nome), update local — não precisa cascade
        if (sameName) {
            const arr = [...categories];
            arr[editingIndex] = description ? { name, slug, description } : { name, slug };
            setCategories(arr);
            closeModal();
            await saveCategoriesArray(arr);
            return;
        }

        // Renomear nome: chama endpoint server-side que atualiza posts + redirect 301
        closeModal();
        setSaving(true);
        triggerToast(`Renomeando "${old.name}" → "${name}" e atualizando posts...`, 'progress', 20);
        try {
            const res = await fetch('/api/admin/categories/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    oldName: old.name,
                    newName: name,
                    newSlug: slug,
                    description: description || undefined,
                    createRedirect: true,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Falha ao renomear');
            const arr = [...categories];
            arr[editingIndex] = description ? { name, slug, description } : { name, slug };
            setCategories(arr);
            const parts = [`Categoria renomeada para "${name}"`];
            if (data.postsUpdated) parts.push(`${data.postsUpdated} post(s) atualizado(s)`);
            if (data.redirectsCreated) parts.push(`redirect 301 criado`);
            triggerToast(parts.join(' · '), 'success', 100);
            // Recarrega sha do categories.json
            githubApi('read', 'src/data/categories.json').then(d => setFileSha(d.sha)).catch(() => { });
        } catch (err: any) {
            setError('Não foi possível renomear a categoria. Verifique sua conexão.');
            triggerToast('Não foi possível renomear a categoria. Tente novamente.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const removeCategory = async (index: number) => {
        if (!confirm('Excluir esta categoria?')) return;
        const arr = [...categories];
        arr.splice(index, 1);
        setCategories(arr);
        await saveCategoriesArray(arr);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-lg border border-border">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p className="font-medium animate-pulse">Lendo categorias...</p>
        </div>
    );

    return (
        <div className="space-y-8 pb-32">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface/80 backdrop-blur-xl p-5 px-8 rounded-lg border border-border shadow-xl shadow-slate-200/50 sticky top-0 z-40">
                <div>
                    <h2 className="text-lg font-bold text-ink">Gerenciador de Categorias</h2>
                    <p className="text-xs font-bold text-ink-muted uppercase tracking-widest mt-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full border-2 border-primary/40"></span>
                        {categories.length} Categorias Definidas
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {saving && <div className="flex items-center gap-2 text-ink-muted bg-elev px-4 py-2 rounded-lg text-sm font-bold mr-2"><Loader2 className="w-4 h-4 animate-spin" /> Sincronizando...</div>}
                    <button onClick={openCreate} disabled={saving}
                        className="w-full sm:w-auto bg-primary hover:bg-primary disabled:opacity-50 disabled:bg-elev disabled:cursor-not-allowed text-white px-6 py-3 rounded-md font-bold flex items-center justify-center gap-2 shadow-lg shadow-none hover:-translate-y-0.5 transition-all">
                        <Plus className="w-5 h-5" aria-hidden="true" /> Nova Categoria
                    </button>
                </div>
            </div>

            {error && <div className="p-5 bg-red-100/50 text-red-700 rounded-lg font-bold border border-red-200"><AlertCircle className="w-5 h-5 inline mr-2 -mt-1" /> {error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.length === 0 ? (
                    <div className="col-span-full bg-elev border-2 border-dashed border-border rounded-lg p-16 flex flex-col items-center justify-center text-center">
                        <Tag className="w-12 h-12 text-ink-faint mb-4" />
                        <h3 className="text-xl font-bold text-ink mb-2">Nenhuma categoria!</h3>
                        <p className="text-ink-muted mb-6">Crie categorias para organizar seus artigos do blog.</p>
                        <button onClick={openCreate} className="bg-primary text-white font-bold px-8 py-3 rounded-md shadow-md hover:bg-primary transition-colors">
                            Criar minha primeira categoria
                        </button>
                    </div>
                ) : categories.map((cat, idx) => (
                    <div key={idx} className="bg-surface p-5 rounded-lg border border-border shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-md bg-elev text-ink-muted flex items-center justify-center font-bold shrink-0"><Tag className="w-5 h-5" aria-hidden="true" /></div>
                                <div className="min-w-0">
                                    <p className="font-bold text-ink truncate">{cat.name}</p>
                                    <p className="text-[11px] font-mono text-ink-faint truncate">/categoria/{cat.slug}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button onClick={() => openEdit(idx)} aria-label={`Editar categoria: ${cat.name}`} className="p-2 min-h-[44px] min-w-[44px] text-ink-faint hover:text-ink-muted hover:bg-elev rounded-lg transition-colors"><Edit2 className="w-4 h-4" aria-hidden="true" /></button>
                                <button onClick={() => removeCategory(idx)} aria-label={`Excluir categoria: ${cat.name}`} className="p-2 min-h-[44px] min-w-[44px] text-ink-faint hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
                            </div>
                        </div>
                        {cat.description && (
                            <p className="text-xs text-ink-muted leading-relaxed line-clamp-2">{cat.description}</p>
                        )}
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm" onClick={closeModal} aria-hidden="true">
                    <div
                        ref={modalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="modal-cat-title"
                        className="bg-surface rounded-lg w-full max-w-md"
                        style={{ boxShadow: '0 20px 48px rgba(80,40,20,0.18)' }}
                        onClick={e => e.stopPropagation()}
                        aria-hidden="false"
                    >
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <h3 id="modal-cat-title" className="text-lg font-bold text-ink">{editingIndex !== null ? 'Editar Categoria' : 'Nova Categoria'}</h3>
                            <button onClick={closeModal} aria-label="Fechar modal" className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-faint hover:text-ink hover:bg-elev rounded transition-colors"><X className="w-5 h-5" aria-hidden="true" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Nome</label>
                                <input
                                    type="text"
                                    value={tempName}
                                    onChange={e => handleNameChange(e.target.value)}
                                    className="w-full bg-elev border border-border rounded-md px-4 py-3 text-ink font-bold focus:ring-2 focus:ring-primary/30 outline-none"
                                    placeholder="Ex: Tecnologia, Saúde…"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2 flex items-center gap-2">
                                    Slug da URL
                                    {!slugTouched && tempName && <span className="font-mono text-[9px] text-primary normal-case tracking-normal">(auto-gerado)</span>}
                                </label>
                                <div className="flex items-stretch gap-0 bg-elev border border-border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-primary/30">
                                    <span className="px-3 flex items-center font-mono text-xs text-ink-faint bg-elev border-r border-border">/categoria/</span>
                                    <input
                                        type="text"
                                        value={tempSlug}
                                        onChange={e => handleSlugChange(e.target.value)}
                                        className="flex-1 bg-transparent px-3 py-3 text-ink font-mono text-sm focus:outline-none"
                                        placeholder="exemplo-de-slug"
                                    />
                                </div>
                                <p className="text-[10px] text-ink-faint mt-1.5 leading-relaxed">
                                    URL final: <code className="bg-elev px-1 rounded">/categoria/{tempSlug || '...'}</code>
                                </p>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Descrição <span className="text-ink-faint normal-case tracking-normal">(opcional, aparece no topo da página da categoria)</span></label>
                                <textarea
                                    rows={2}
                                    value={tempDesc}
                                    onChange={e => setTempDesc(e.target.value)}
                                    className="w-full bg-elev border border-border rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 outline-none resize-y"
                                    placeholder="Breve descrição do tópico…"
                                />
                            </div>
                        </div>
                        <div className="px-6 pb-2">
                            {modalError && (
                                <p role="alert" className="text-sm text-red-700 font-medium flex items-center gap-1.5 py-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                                    {modalError}
                                </p>
                            )}
                        </div>
                        <div className="p-6 border-t border-border flex gap-3 justify-end">
                            <button onClick={closeModal} className="px-5 py-2.5 min-h-[44px] font-semibold text-ink-muted hover:bg-elev rounded transition-colors">Cancelar</button>
                            <button onClick={saveModalCategory} className="px-6 py-2.5 min-h-[44px] font-semibold bg-primary hover:brightness-90 text-surface rounded transition-all">Salvar categoria</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
