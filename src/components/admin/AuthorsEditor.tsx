import React, { useState, useEffect, useRef } from 'react';
import { Save, AlertCircle, Loader2, Plus, Trash2, UserPlus, Image as ImageIcon, Users, X, Edit2 } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

export default function AuthorsEditor() {
    const [authors, setAuthors] = useState<any[]>([]);
    const [fileSha, setFileSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [tempAuthor, setTempAuthor] = useState<any>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isModalOpen) return;
        const modal = modalRef.current;
        if (!modal) return;
        const focusable = Array.from(modal.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(el => !el.hasAttribute('disabled'));
        focusable[0]?.focus();
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setIsModalOpen(false); return; }
            if (e.key !== 'Tab') return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isModalOpen]);

    useEffect(() => {
        githubApi('read', 'src/data/authors.json')
            .then(data => {
                const parsed = JSON.parse(data?.content || "{}");
                setAuthors(Array.isArray(parsed) ? parsed : []);
                setFileSha(data.sha);
            })
            .catch(err => {
                if (err.message.includes('404')) setAuthors([]);
                else setError(err.message);
            })
            .finally(() => setLoading(false));
    }, []);

    const saveToGithub = async (list: any[]) => {
        setSaving(true); setError('');
        triggerToast('Sincronizando arquivo de autores...', 'progress', 20);
        try {
            const data = await githubApi('write', 'src/data/authors.json', {
                content: JSON.stringify(list, null, 2),
                sha: fileSha || undefined,
                message: 'CMS: Update authors.json'
            });
            setFileSha(data.sha);
            triggerToast('Equipe sincronizada com sucesso!', 'success', 100);
        } catch (err: any) {
            setError(err.message);
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setTempAuthor({ ...tempAuthor, avatar: reader.result as string });
        reader.readAsDataURL(file);
    };

    const saveModalAuthor = async () => {
        if (!tempAuthor?.name?.trim()) { alert('O nome do autor é obrigatório!'); return; }
        const arr = [...authors];
        if (editingIndex === null) arr.unshift(tempAuthor);
        else arr[editingIndex] = tempAuthor;
        setAuthors(arr);
        setIsModalOpen(false);
        setTempAuthor(null);
        setEditingIndex(null);
        await saveToGithub(arr);
    };

    const removeAuthor = async (index: number) => {
        if (!confirm('Excluir este autor?')) return;
        const arr = [...authors];
        arr.splice(index, 1);
        setAuthors(arr);
        await saveToGithub(arr);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-lg border border-border">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p className="font-medium animate-pulse">Lendo registros de autores...</p>
        </div>
    );

    return (
        <div className="space-y-8 pb-32">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface/80 backdrop-blur-xl p-5 px-8 rounded-lg border border-border shadow-xl shadow-slate-200/50 sticky top-0 z-40">
                <div>
                    <h2 className="text-lg font-bold text-ink">Sincronização de Equipe</h2>
                    <p className="text-xs font-bold text-ink-muted uppercase tracking-widest mt-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full border-2 border-primary"></span>
                        {authors.length} Perfis Cadastrados
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {saving && <div className="flex items-center gap-2 text-primary bg-elev px-4 py-2 rounded-lg text-sm font-bold mr-2"><Loader2 className="w-4 h-4 animate-spin" /> Sincronizando...</div>}
                    <button onClick={() => { setTempAuthor({ id: `author-${Date.now()}`, name: '', role: '', avatar: '', bio: '', social: { twitter: '', instagram: '', linkedin: '', website: '' } }); setEditingIndex(null); setIsModalOpen(true); }} disabled={saving}
                        className="w-full sm:w-auto bg-primary hover:bg-primary disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-md font-bold flex items-center justify-center gap-2 shadow-lg shadow-none hover:-translate-y-0.5 transition-all">
                        <UserPlus className="w-5 h-5" aria-hidden="true" /> Adicionar Perfil
                    </button>
                </div>
            </div>

            {error && <div className="p-5 bg-red-100/50 text-red-700 rounded-lg font-bold border border-red-200"><AlertCircle className="w-5 h-5 inline mr-2 -mt-1" /> {error}</div>}

            {authors.length === 0 ? (
                <div className="bg-elev border-2 border-dashed border-border rounded-lg p-16 flex flex-col items-center justify-center text-center w-full mt-6">
                    <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center text-ink-faint mb-4 shadow-sm"><Users className="w-10 h-10" /></div>
                    <h3 className="text-xl font-bold text-ink mb-2">Sua equipe está vazia!</h3>
                    <p className="text-ink-muted max-w-sm mx-auto mb-6">Adicione membros da equipe para que eles possam assinar os artigos do blog.</p>
                    <button onClick={() => { setTempAuthor({ id: `author-${Date.now()}`, name: '', role: '', avatar: '', bio: '', social: { twitter: '', instagram: '', linkedin: '', website: '' } }); setEditingIndex(null); setIsModalOpen(true); }}
                        className="bg-primary text-white font-bold px-8 py-3 rounded-md shadow-md hover:bg-primary transition-colors inline-flex items-center gap-2">
                        <Plus className="w-5 h-5" aria-hidden="true" /> Adicionar Primeiro Autor
                    </button>
                </div>
            ) : (
                <div className="bg-surface rounded-md border border-border overflow-hidden shadow-sm mt-6">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-elev border-b border-border">
                                    <th className="py-4 px-6 text-sm font-bold text-ink-muted uppercase tracking-wider w-24">Foto</th>
                                    <th className="py-4 px-6 text-sm font-bold text-ink-muted uppercase tracking-wider min-w-[250px]">Dados Pessoais</th>
                                    <th className="py-4 px-6 text-sm font-bold text-ink-muted uppercase tracking-wider min-w-[300px]">Biografia</th>
                                    <th className="py-4 px-6 text-sm font-bold text-ink-muted uppercase tracking-wider text-right w-20">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {authors.map((author, idx) => (
                                    <tr key={author.id || idx} className="hover:bg-elev transition-colors group">
                                        <td className="py-4 px-6 align-middle">
                                            <div className="w-12 h-12 rounded-full overflow-hidden shadow-sm flex items-center justify-center shrink-0 bg-surface border-2 border-border">
                                                {author.avatar ? <img src={author.avatar} alt="Avatar" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-ink-faint" />}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 align-middle">
                                            <p className="font-bold text-ink text-sm mb-1">{author.name || 'Sem nome'}</p>
                                            <p className="text-xs font-bold text-primary">{author.role || 'Sem cargo'}</p>
                                        </td>
                                        <td className="py-4 px-6 align-middle">
                                            <p className="text-sm text-ink-muted line-clamp-2 leading-relaxed">{author.bio || 'Sem biografia cadastrada...'}</p>
                                        </td>
                                        <td className="py-4 px-6 align-middle text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => { setTempAuthor({ ...author }); setEditingIndex(idx); setIsModalOpen(true); }}
                                                    className="w-8 h-8 bg-elev text-ink-muted rounded-lg inline-flex items-center justify-center hover:bg-elev hover:text-ink transition-colors">
                                                    <Edit2 className="w-4 h-4" aria-hidden="true" />
                                                </button>
                                                <button onClick={() => removeAuthor(idx)}
                                                    className="w-8 h-8 bg-red-50 text-red-500 rounded-lg inline-flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
                                                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isModalOpen && tempAuthor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm" aria-hidden="true">
                    <div
                        ref={modalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="modal-author-title"
                        aria-hidden="false"
                        className="bg-surface rounded-lg w-full max-w-md overflow-hidden flex flex-col"
                        style={{ boxShadow: '0 20px 48px rgba(80,40,20,0.18)' }}
                    >
                        <div className="flex items-center justify-between p-6 border-b border-border bg-elev/50">
                            <h3 id="modal-author-title" className="text-lg font-bold text-ink">{editingIndex !== null ? 'Editar Autor' : 'Novo Autor'}</h3>
                            <button onClick={() => setIsModalOpen(false)} aria-label="Fechar modal" className="w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-faint hover:text-ink hover:bg-elev rounded transition-colors"><X className="w-4 h-4" aria-hidden="true" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-6">
                            <label aria-label="Foto do autor — clique para fazer upload" className="w-28 h-28 rounded-full overflow-hidden border-4 border-border shadow-inner bg-elev flex flex-col items-center justify-center mx-auto relative group cursor-pointer">
                                <input type="file" accept="image/*" className="hidden" aria-label="Selecionar foto do autor" onChange={handleImageUpload} />
                                {tempAuthor.avatar ? (
                                    <>
                                        <img src={tempAuthor.avatar} alt="Avatar" className="absolute inset-0 w-full h-full object-cover group-hover:opacity-40 transition-opacity" />
                                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ImageIcon className="w-8 h-8 text-ink drop-shadow-md" />
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center text-ink-faint group-hover:text-primary transition-colors">
                                        <ImageIcon className="w-8 h-8 mb-1" />
                                        <span className="text-[9px] font-black uppercase tracking-wider">Upload PNG</span>
                                    </div>
                                )}
                            </label>
                            <div className="space-y-4 w-full">
                                {[
                                    { key: 'name', label: 'Nome Completo', placeholder: 'Ex: João da Silva', type: 'text' },
                                    { key: 'role', label: 'Cargo / Profissão', placeholder: 'Ex: Editor Chefe', type: 'text' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="block text-xs font-black text-ink-faint mb-1 uppercase tracking-widest text-center">{f.label}</label>
                                        <input type={f.type} placeholder={f.placeholder} value={tempAuthor[f.key] || ''} onChange={e => setTempAuthor({ ...tempAuthor, [f.key]: e.target.value })}
                                            className="w-full bg-elev border border-border rounded-md px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 font-bold text-center" />
                                    </div>
                                ))}
                                <div>
                                    <label className="block text-xs font-black text-ink-faint mb-1 uppercase tracking-widest text-center">Resumo Biográfico</label>
                                    <textarea rows={4} placeholder="Escreva sobre as especialidades do autor..." value={tempAuthor.bio || ''} onChange={e => setTempAuthor({ ...tempAuthor, bio: e.target.value })}
                                        className="w-full bg-elev border border-border rounded-md px-4 py-3 text-sm text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none text-center leading-relaxed" />
                                </div>
                                <div className="pt-4 border-t border-border">
                                    <p className="text-xs font-black text-ink-faint mb-3 uppercase tracking-widest text-center">Redes Sociais</p>
                                    <div className="space-y-3">
                                        {[
                                            { key: 'twitter', label: 'Twitter / X', placeholder: 'https://twitter.com/usuario' },
                                            { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/usuario' },
                                            { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/usuario' },
                                            { key: 'website', label: 'Website', placeholder: 'https://seusite.com' },
                                        ].map(f => (
                                            <div key={f.key}>
                                                <label className="block text-[10px] font-bold text-ink-faint mb-1 uppercase tracking-wider">{f.label}</label>
                                                <input
                                                    type="url"
                                                    placeholder={f.placeholder}
                                                    value={tempAuthor?.social?.[f.key] || ''}
                                                    onChange={e => setTempAuthor({
                                                        ...tempAuthor,
                                                        social: { ...(tempAuthor.social || {}), [f.key]: e.target.value }
                                                    })}
                                                    className="w-full bg-elev border border-border rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-border bg-elev flex gap-3 justify-end rounded-b-lg">
                            <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 min-h-[44px] text-sm font-semibold text-ink-muted hover:bg-surface rounded transition-colors">Cancelar</button>
                            <button onClick={saveModalAuthor} className="px-6 py-2.5 min-h-[44px] text-sm font-semibold bg-primary hover:brightness-90 text-surface rounded flex items-center gap-2 transition-all">
                                <Save className="w-4 h-4" aria-hidden="true" /> Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
