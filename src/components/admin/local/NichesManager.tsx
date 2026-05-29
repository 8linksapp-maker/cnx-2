import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Loader2, Plus, Trash2, Layers, X, Edit2 } from 'lucide-react';
import { triggerToast } from '../CmsToaster';
import { githubApi } from '../../../lib/adminApi';
import { slugify } from '../../../lib/slugify';
import type { Niche } from '../../../lib/localTypes';

// Sugestões de cor alinhadas à paleta editorial (o usuário pode escolher qualquer hex).
const COLOR_SUGGESTIONS = ['#c5563e', '#3458a2', '#5f7436', '#c49838', '#8c344c', '#8b4a36'];

export default function NichesManager() {
    const [niches, setNiches] = useState<Niche[]>([]);
    const [fileSha, setFileSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [tempName, setTempName] = useState('');
    const [tempSlug, setTempSlug] = useState('');
    const [slugTouched, setSlugTouched] = useState(false);
    const [tempIcon, setTempIcon] = useState('');
    const [tempDesc, setTempDesc] = useState('');
    const [tempColor, setTempColor] = useState('#c5563e');
    const [tempActive, setTempActive] = useState(true);
    const [modalError, setModalError] = useState('');
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        githubApi('read', 'src/data/nichos.json')
            .then(data => {
                const parsed = JSON.parse(data?.content || '[]');
                setNiches(Array.isArray(parsed) ? parsed : []);
                setFileSha(data.sha);
            })
            .catch(err => {
                if (err.message.includes('404')) setNiches([]);
                else setError(err.message);
            })
            .finally(() => setLoading(false));
    }, []);

    const openCreate = () => {
        setTempName(''); setTempSlug(''); setTempIcon(''); setTempDesc('');
        setTempColor('#c5563e'); setTempActive(true);
        setSlugTouched(false); setEditingIndex(null); setModalError('');
        setIsModalOpen(true);
    };
    const openEdit = (idx: number) => {
        const n = niches[idx];
        setTempName(n.name); setTempSlug(n.slug); setTempIcon(n.icon || '');
        setTempDesc(n.description || ''); setTempColor(n.color || '#c5563e');
        setTempActive(n.active !== false);
        setSlugTouched(true); setEditingIndex(idx); setModalError('');
        setIsModalOpen(true);
    };
    const closeModal = () => { setIsModalOpen(false); setModalError(''); };

    // Focus trap + ESC
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

    const handleNameChange = (value: string) => {
        setTempName(value);
        if (!slugTouched) setTempSlug(slugify(value));
    };
    const handleSlugChange = (value: string) => {
        setSlugTouched(true);
        setTempSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'));
    };

    const saveArray = async (newList: Niche[]) => {
        setSaving(true); setError('');
        triggerToast('Salvando nichos...', 'progress', 20);
        try {
            const data = await githubApi('write', 'src/data/nichos.json', {
                content: JSON.stringify(newList, null, 2),
                sha: fileSha || undefined,
                message: 'CMS: atualiza nichos.json',
            });
            setFileSha(data.sha);
            triggerToast('Nichos atualizados!', 'success', 100);
        } catch {
            setError('Não foi possível salvar os nichos. Verifique sua conexão.');
            triggerToast('Não foi possível salvar os nichos. Tente novamente.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const saveModal = async () => {
        setModalError('');
        const name = tempName.trim();
        const slug = (tempSlug.trim() || slugify(name)).replace(/^-|-$/g, '');
        if (!name) { setModalError('Digite o nome do nicho.'); return; }
        if (!slug) { setModalError('Dê uma identificação pra esse nicho.'); return; }
        if (!/^#[0-9a-fA-F]{6}$/.test(tempColor)) { setModalError('Escolha uma cor válida.'); return; }

        const collision = niches.find((n, i) => i !== editingIndex && (n.name === name || n.slug === slug));
        if (collision) { setModalError(`"${collision.name}" já existe. Escolha um nome ou identificação diferente.`); return; }

        const entry: Niche = {
            name, slug, color: tempColor.toLowerCase(), active: tempActive,
            ...(tempIcon.trim() ? { icon: tempIcon.trim() } : {}),
            ...(tempDesc.trim() ? { description: tempDesc.trim() } : {}),
        };
        const arr = editingIndex === null ? [...niches, entry] : niches.map((n, i) => i === editingIndex ? entry : n);
        setNiches(arr);
        closeModal();
        await saveArray(arr);
    };

    const removeNiche = async (idx: number) => {
        if (!confirm('Excluir este nicho? Os serviços que usam ele perdem a cor.')) return;
        const arr = niches.filter((_, i) => i !== idx);
        setNiches(arr);
        await saveArray(arr);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-lg border border-border">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p className="font-medium animate-pulse">Lendo nichos...</p>
        </div>
    );

    return (
        <div className="space-y-6 pb-32">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-ink">Nichos</h2>
                    <p className="text-sm text-ink-muted mt-0.5">
                        Cada nicho agrupa serviços e dá a cor das páginas. {niches.length} cadastrado{niches.length === 1 ? '' : 's'}.
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {saving && <span className="flex items-center gap-2 text-ink-muted text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</span>}
                    <button onClick={openCreate} disabled={saving}
                        className="w-full sm:w-auto bg-primary hover:brightness-90 disabled:opacity-50 text-surface px-5 py-2.5 min-h-[44px] rounded font-semibold flex items-center justify-center gap-2 transition-all">
                        <Plus className="w-4 h-4" aria-hidden="true" /> Novo nicho
                    </button>
                </div>
            </div>

            {error && <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200 text-sm"><AlertCircle className="w-4 h-4 inline mr-2 -mt-0.5" />{error}</div>}

            {niches.length === 0 ? (
                <div className="bg-elev border-2 border-dashed border-border rounded-lg p-16 flex flex-col items-center justify-center text-center">
                    <Layers className="w-12 h-12 text-ink-faint mb-4" aria-hidden="true" />
                    <h3 className="text-lg font-bold text-ink mb-1">Nenhum nicho ainda</h3>
                    <p className="text-ink-muted mb-6">Crie um nicho para organizar seus serviços por cor e tema.</p>
                    <button onClick={openCreate} className="bg-primary text-surface font-semibold px-6 py-3 rounded hover:brightness-90 transition-all">Criar primeiro nicho</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {niches.map((n, idx) => (
                        <div key={idx} className="bg-surface p-5 rounded-lg border border-border shadow-sm hover:shadow-md transition-all group">
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-md flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: n.color }} aria-hidden="true">
                                        {n.icon || ''}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-ink truncate">{n.name}</p>
                                        <p className="text-[11px] font-mono text-ink-faint truncate">/{n.slug}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                                    <button onClick={() => openEdit(idx)} aria-label={`Editar nicho: ${n.name}`} className="p-2 min-h-[44px] min-w-[44px] text-ink-faint hover:text-ink-muted hover:bg-elev rounded transition-colors"><Edit2 className="w-4 h-4" aria-hidden="true" /></button>
                                    <button onClick={() => removeNiche(idx)} aria-label={`Excluir nicho: ${n.name}`} className="p-2 min-h-[44px] min-w-[44px] text-ink-faint hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
                                </div>
                            </div>
                            {n.description && <p className="text-xs text-ink-muted leading-relaxed line-clamp-2">{n.description}</p>}
                            {n.active === false && <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wide text-ink-faint bg-elev px-2 py-0.5 rounded">Inativo</span>}
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm" onClick={closeModal} aria-hidden="true">
                    <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="modal-niche-title"
                        className="bg-surface rounded-lg w-full max-w-md" style={{ boxShadow: '0 20px 48px rgba(80,40,20,0.18)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <h3 id="modal-niche-title" className="text-lg font-bold text-ink">{editingIndex !== null ? 'Editar nicho' : 'Novo nicho'}</h3>
                            <button onClick={closeModal} aria-label="Fechar" className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-faint hover:text-ink hover:bg-elev rounded transition-colors"><X className="w-5 h-5" aria-hidden="true" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label htmlFor="niche-name" className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Nome</label>
                                <input id="niche-name" type="text" value={tempName} onChange={e => handleNameChange(e.target.value)}
                                    className="w-full bg-elev border border-border rounded-md px-4 py-3 text-ink font-semibold focus:ring-2 focus:ring-primary/30 outline-none"
                                    placeholder="Ex: Aluguel de Andaime" autoFocus />
                            </div>
                            <div className="grid grid-cols-[1fr_auto] gap-3">
                                <div>
                                    <label htmlFor="niche-slug" className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">
                                        Identificação {!slugTouched && tempName && <span className="font-mono text-[9px] text-primary normal-case tracking-normal">(auto)</span>}
                                    </label>
                                    <input id="niche-slug" type="text" value={tempSlug} onChange={e => handleSlugChange(e.target.value)}
                                        className="w-full bg-elev border border-border rounded-md px-4 py-3 text-ink font-mono text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                                        placeholder="aluguel-andaime" />
                                </div>
                                <div>
                                    <label htmlFor="niche-icon" className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Ícone</label>
                                    <input id="niche-icon" type="text" value={tempIcon} onChange={e => setTempIcon(e.target.value)} maxLength={2}
                                        className="w-16 text-center bg-elev border border-border rounded-md px-2 py-3 text-lg focus:ring-2 focus:ring-primary/30 outline-none"
                                        placeholder="🪜" aria-label="Emoji do nicho" />
                                </div>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Cor das páginas</span>
                                <div className="flex items-center gap-3">
                                    <input type="color" value={tempColor} onChange={e => setTempColor(e.target.value)}
                                        className="w-12 h-11 rounded border border-border bg-surface cursor-pointer p-1" aria-label="Seletor de cor" />
                                    <input type="text" value={tempColor} onChange={e => setTempColor(e.target.value)}
                                        className="w-28 bg-elev border border-border rounded-md px-3 py-3 text-ink font-mono text-sm uppercase focus:ring-2 focus:ring-primary/30 outline-none"
                                        aria-label="Código hexadecimal da cor" />
                                    <div className="flex gap-1.5">
                                        {COLOR_SUGGESTIONS.map(c => (
                                            <button key={c} type="button" onClick={() => setTempColor(c)}
                                                className="w-7 h-7 rounded-full border border-border hover:scale-110 transition-transform"
                                                style={{ backgroundColor: c }} aria-label={`Usar cor ${c}`} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="niche-desc" className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Descrição <span className="text-ink-faint normal-case tracking-normal">(opcional)</span></label>
                                <textarea id="niche-desc" rows={2} value={tempDesc} onChange={e => setTempDesc(e.target.value)}
                                    className="w-full bg-elev border border-border rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 outline-none resize-y"
                                    placeholder="Locação de andaimes para obras…" />
                            </div>
                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <input type="checkbox" checked={tempActive} onChange={e => setTempActive(e.target.checked)} className="w-4 h-4 accent-primary" />
                                <span className="text-sm font-medium text-ink">Nicho ativo</span>
                            </label>
                        </div>
                        {modalError && (
                            <div className="px-6 pb-2">
                                <p role="alert" className="text-sm text-red-700 font-medium flex items-center gap-1.5 py-2"><AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />{modalError}</p>
                            </div>
                        )}
                        <div className="p-6 border-t border-border flex gap-3 justify-end">
                            <button onClick={closeModal} className="px-5 py-2.5 min-h-[44px] font-semibold text-ink-muted hover:bg-elev rounded transition-colors">Cancelar</button>
                            <button onClick={saveModal} className="px-6 py-2.5 min-h-[44px] font-semibold bg-primary hover:brightness-90 text-surface rounded transition-all">Salvar nicho</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
