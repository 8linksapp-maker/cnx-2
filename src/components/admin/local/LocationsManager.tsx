import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Loader2, Plus, Trash2, MapPin, X, Edit2, Upload, Search } from 'lucide-react';
import { triggerToast } from '../CmsToaster';
import { githubApi } from '../../../lib/adminApi';
import { slugify } from '../../../lib/slugify';
import type { Location } from '../../../lib/localTypes';

const TYPES: Location['type'][] = ['cidade', 'bairro', 'regiao', 'zona'];
const TYPE_LABEL: Record<Location['type'], string> = { cidade: 'Cidade', bairro: 'Bairro', regiao: 'Região', zona: 'Zona' };

export default function LocationsManager() {
    const [locations, setLocations] = useState<Location[]>([]);
    const [fileSha, setFileSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [tempName, setTempName] = useState('');
    const [tempSlug, setTempSlug] = useState('');
    const [slugTouched, setSlugTouched] = useState(false);
    const [tempState, setTempState] = useState('');
    const [tempType, setTempType] = useState<Location['type']>('cidade');
    const [tempCity, setTempCity] = useState('');
    const [tempActive, setTempActive] = useState(true);
    const [modalError, setModalError] = useState('');

    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importText, setImportText] = useState('');
    const [importType, setImportType] = useState<Location['type']>('cidade');
    const [importCity, setImportCity] = useState('');
    const [importError, setImportError] = useState('');

    useEffect(() => {
        githubApi('read', 'src/data/locations.json')
            .then(data => { setLocations(JSON.parse(data?.content || '[]')); setFileSha(data.sha); })
            .catch(err => { if (err.message.includes('404')) setLocations([]); else setError(err.message); })
            .finally(() => setLoading(false));
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list = locations.map((l, i) => ({ l, i }));
        if (!q) return list;
        return list.filter(({ l }) => l.name.toLowerCase().includes(q) || (l.city || '').toLowerCase().includes(q) || l.state.toLowerCase().includes(q));
    }, [locations, query]);

    const openCreate = () => {
        setTempName(''); setTempSlug(''); setTempState(''); setTempType('cidade'); setTempCity(''); setTempActive(true);
        setSlugTouched(false); setEditingIndex(null); setModalError(''); setIsModalOpen(true);
    };
    const openEdit = (idx: number) => {
        const l = locations[idx];
        setTempName(l.name); setTempSlug(l.slug); setTempState(l.state || ''); setTempType(l.type || 'cidade');
        setTempCity(l.city || ''); setTempActive(l.active !== false);
        setSlugTouched(true); setEditingIndex(idx); setModalError(''); setIsModalOpen(true);
    };
    const closeModal = () => { setIsModalOpen(false); setModalError(''); };

    useEffect(() => {
        if (!isModalOpen && !isImportOpen) return;
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setIsModalOpen(false); setIsImportOpen(false); } };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isModalOpen, isImportOpen]);

    const handleNameChange = (v: string) => { setTempName(v); if (!slugTouched) setTempSlug(slugify(v)); };
    const handleSlugChange = (v: string) => { setSlugTouched(true); setTempSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')); };

    const saveArray = async (newList: Location[]) => {
        setSaving(true); setError('');
        triggerToast('Salvando localidades...', 'progress', 20);
        try {
            const data = await githubApi('write', 'src/data/locations.json', {
                content: JSON.stringify(newList, null, 2), sha: fileSha || undefined, message: 'CMS: atualiza locations.json',
            });
            setFileSha(data.sha);
            triggerToast('Localidades atualizadas!', 'success', 100);
        } catch {
            setError('Não foi possível salvar as localidades. Verifique sua conexão.');
            triggerToast('Não foi possível salvar as localidades. Tente novamente.', 'error');
        } finally { setSaving(false); }
    };

    const buildLocation = (name: string, slug: string, state: string, type: Location['type'], city: string): Location => {
        const base: Location = { name, slug, state: state.toUpperCase(), type, active: tempActive };
        if (type !== 'cidade' && city.trim()) { base.city = city.trim(); base.citySlug = slugify(city); }
        return base;
    };

    const saveModal = async () => {
        setModalError('');
        const name = tempName.trim();
        const slug = (tempSlug.trim() || slugify(name)).replace(/^-|-$/g, '');
        const state = tempState.trim();
        if (!name) { setModalError('Digite o nome da localidade.'); return; }
        if (!slug) { setModalError('Defina o endereço (URL) da localidade.'); return; }
        if (!/^[A-Za-z]{2}$/.test(state)) { setModalError('Informe o estado com 2 letras (ex: SP).'); return; }

        const collision = locations.find((l, i) => i !== editingIndex && l.slug === slug);
        if (collision) { setModalError(`A URL "${slug}" já existe ("${collision.name}"). Escolha outra.`); return; }

        const entry = buildLocation(name, slug, state, tempType, tempCity);
        const arr = editingIndex === null ? [...locations, entry] : locations.map((l, i) => i === editingIndex ? entry : l);
        setLocations(arr); closeModal(); await saveArray(arr);
    };

    const removeLocation = async (idx: number) => {
        if (!confirm('Excluir esta localidade? As páginas dela deixam de ser geradas.')) return;
        const arr = locations.filter((_, i) => i !== idx);
        setLocations(arr); await saveArray(arr);
    };

    // ── Import em massa: "Nome, UF" por linha ──
    const runImport = async () => {
        setImportError('');
        const lines = importText.split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length) { setImportError('Cole pelo menos uma linha no formato "Cidade, UF".'); return; }

        const existingSlugs = new Set(locations.map(l => l.slug));
        const added: Location[] = [];
        const skipped: string[] = [];
        for (const line of lines) {
            const parts = line.split(',').map(p => p.trim());
            const name = parts[0];
            const uf = (parts[1] || '').toUpperCase();
            if (!name || !/^[A-Za-z]{2}$/.test(uf)) { skipped.push(line); continue; }
            const slug = slugify(name);
            if (!slug || existingSlugs.has(slug) || added.some(a => a.slug === slug)) { skipped.push(line); continue; }
            const loc: Location = { name, slug, state: uf, type: importType, active: true };
            if (importType !== 'cidade' && importCity.trim()) { loc.city = importCity.trim(); loc.citySlug = slugify(importCity); }
            added.push(loc);
        }

        if (!added.length) { setImportError(`Nada para importar. ${skipped.length} linha(s) inválida(s) ou duplicada(s).`); return; }

        const arr = [...locations, ...added];
        setLocations(arr);
        setIsImportOpen(false); setImportText(''); setImportCity('');
        await saveArray(arr);
        triggerToast(`${added.length} localidade(s) importada(s)${skipped.length ? ` · ${skipped.length} ignorada(s)` : ''}.`, 'success', 100);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-lg border border-border">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p className="font-medium animate-pulse">Lendo localidades...</p>
        </div>
    );

    return (
        <div className="space-y-6 pb-32">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-ink">Localidades</h2>
                    <p className="text-sm text-ink-muted mt-0.5">Cidades e bairros atendidos. {locations.length} cadastrada{locations.length === 1 ? '' : 's'}.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {saving && <span className="flex items-center gap-2 text-ink-muted text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</span>}
                    <button onClick={() => { setImportError(''); setIsImportOpen(true); }} disabled={saving}
                        className="bg-elev hover:bg-border/40 disabled:opacity-50 text-ink px-4 py-2.5 min-h-[44px] rounded font-semibold flex items-center justify-center gap-2 transition-all">
                        <Upload className="w-4 h-4" aria-hidden="true" /> Importar
                    </button>
                    <button onClick={openCreate} disabled={saving}
                        className="bg-primary hover:brightness-90 disabled:opacity-50 text-surface px-5 py-2.5 min-h-[44px] rounded font-semibold flex items-center justify-center gap-2 transition-all">
                        <Plus className="w-4 h-4" aria-hidden="true" /> Nova
                    </button>
                </div>
            </div>

            {error && <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200 text-sm"><AlertCircle className="w-4 h-4 inline mr-2 -mt-0.5" />{error}</div>}

            {locations.length > 0 && (
                <div className="relative max-w-sm">
                    <Search className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nome, cidade ou UF…"
                        className="w-full bg-surface border border-border rounded-md pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none" aria-label="Buscar localidade" />
                </div>
            )}

            {locations.length === 0 ? (
                <div className="bg-elev border-2 border-dashed border-border rounded-lg p-16 flex flex-col items-center justify-center text-center">
                    <MapPin className="w-12 h-12 text-ink-faint mb-4" aria-hidden="true" />
                    <h3 className="text-lg font-bold text-ink mb-1">Nenhuma localidade ainda</h3>
                    <p className="text-ink-muted mb-6">Adicione uma a uma, ou importe várias de uma vez (uma "Cidade, UF" por linha).</p>
                    <div className="flex gap-3">
                        <button onClick={openCreate} className="bg-primary text-surface font-semibold px-6 py-3 rounded hover:brightness-90 transition-all">Adicionar localidade</button>
                        <button onClick={() => setIsImportOpen(true)} className="bg-elev text-ink font-semibold px-6 py-3 rounded hover:bg-border/40 transition-all">Importar em massa</button>
                    </div>
                </div>
            ) : (
                <div className="bg-surface border border-border rounded-lg divide-y divide-border">
                    {filtered.length === 0 ? (
                        <p className="p-6 text-sm text-ink-faint">Nenhuma localidade encontrada para "{query}".</p>
                    ) : filtered.map(({ l, i }) => (
                        <div key={i} className="flex items-center justify-between gap-3 px-5 py-3 group">
                            <div className="flex items-center gap-3 min-w-0">
                                <MapPin className="w-4 h-4 text-ink-faint shrink-0" aria-hidden="true" />
                                <div className="min-w-0">
                                    <p className="font-semibold text-ink truncate">
                                        {l.name}
                                        {l.active === false && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-ink-faint bg-elev px-1.5 py-0.5 rounded">Inativa</span>}
                                    </p>
                                    <p className="text-[11px] font-mono text-ink-faint truncate">
                                        {TYPE_LABEL[l.type]} · {l.state}{l.city && l.city !== l.name ? ` · ${l.city}` : ''} · /{l.slug}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                                <button onClick={() => openEdit(i)} aria-label={`Editar: ${l.name}`} className="p-2 min-h-[44px] min-w-[44px] text-ink-faint hover:text-ink-muted hover:bg-elev rounded transition-colors"><Edit2 className="w-4 h-4" aria-hidden="true" /></button>
                                <button onClick={() => removeLocation(i)} aria-label={`Excluir: ${l.name}`} className="p-2 min-h-[44px] min-w-[44px] text-ink-faint hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal CRUD */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm" onClick={closeModal} aria-hidden="true">
                    <div role="dialog" aria-modal="true" aria-labelledby="modal-loc-title" className="bg-surface rounded-lg w-full max-w-md" style={{ boxShadow: '0 20px 48px rgba(80,40,20,0.18)' }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <h3 id="modal-loc-title" className="text-lg font-bold text-ink">{editingIndex !== null ? 'Editar localidade' : 'Nova localidade'}</h3>
                            <button onClick={closeModal} aria-label="Fechar" className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-faint hover:text-ink hover:bg-elev rounded transition-colors"><X className="w-5 h-5" aria-hidden="true" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-[1fr_auto] gap-3">
                                <div>
                                    <label htmlFor="loc-name" className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Nome</label>
                                    <input id="loc-name" type="text" value={tempName} onChange={e => handleNameChange(e.target.value)} className="w-full bg-elev border border-border rounded-md px-4 py-3 text-ink font-semibold focus:ring-2 focus:ring-primary/30 outline-none" placeholder="Ex: Moema" autoFocus />
                                </div>
                                <div>
                                    <label htmlFor="loc-state" className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Estado</label>
                                    <input id="loc-state" type="text" maxLength={2} value={tempState} onChange={e => setTempState(e.target.value.toUpperCase())} className="w-16 text-center bg-elev border border-border rounded-md px-2 py-3 text-ink font-mono uppercase focus:ring-2 focus:ring-primary/30 outline-none" placeholder="SP" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="loc-slug" className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">URL {!slugTouched && tempName && <span className="font-mono text-[9px] text-primary normal-case tracking-normal">(auto)</span>}</label>
                                    <input id="loc-slug" type="text" value={tempSlug} onChange={e => handleSlugChange(e.target.value)} className="w-full bg-elev border border-border rounded-md px-4 py-3 text-ink font-mono text-sm focus:ring-2 focus:ring-primary/30 outline-none" placeholder="moema" />
                                </div>
                                <div>
                                    <label htmlFor="loc-type" className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Tipo</label>
                                    <select id="loc-type" value={tempType} onChange={e => setTempType(e.target.value as Location['type'])} className="w-full bg-elev border border-border rounded-md px-4 py-3 text-ink text-sm focus:ring-2 focus:ring-primary/30 outline-none">
                                        {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                                    </select>
                                </div>
                            </div>
                            {tempType !== 'cidade' && (
                                <div>
                                    <label htmlFor="loc-city" className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Cidade onde fica <span className="text-ink-faint normal-case tracking-normal">(opcional)</span></label>
                                    <input id="loc-city" type="text" value={tempCity} onChange={e => setTempCity(e.target.value)} className="w-full bg-elev border border-border rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 outline-none" placeholder="São Paulo" />
                                </div>
                            )}
                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <input type="checkbox" checked={tempActive} onChange={e => setTempActive(e.target.checked)} className="w-4 h-4 accent-primary" />
                                <span className="text-sm font-medium text-ink">Ativa</span>
                                <span className="text-xs text-ink-faint">(cidades sempre geram página; bairros só quando ativos)</span>
                            </label>
                        </div>
                        {modalError && <div className="px-6 pb-2"><p role="alert" className="text-sm text-red-700 font-medium flex items-center gap-1.5 py-2"><AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />{modalError}</p></div>}
                        <div className="p-6 border-t border-border flex gap-3 justify-end">
                            <button onClick={closeModal} className="px-5 py-2.5 min-h-[44px] font-semibold text-ink-muted hover:bg-elev rounded transition-colors">Cancelar</button>
                            <button onClick={saveModal} className="px-6 py-2.5 min-h-[44px] font-semibold bg-primary hover:brightness-90 text-surface rounded transition-all">Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Import */}
            {isImportOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm" onClick={() => setIsImportOpen(false)} aria-hidden="true">
                    <div role="dialog" aria-modal="true" aria-labelledby="modal-imp-title" className="bg-surface rounded-lg w-full max-w-lg" style={{ boxShadow: '0 20px 48px rgba(80,40,20,0.18)' }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <h3 id="modal-imp-title" className="text-lg font-bold text-ink">Importar localidades</h3>
                            <button onClick={() => setIsImportOpen(false)} aria-label="Fechar" className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-faint hover:text-ink hover:bg-elev rounded transition-colors"><X className="w-5 h-5" aria-hidden="true" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-ink-muted">Uma localidade por linha, no formato <code className="bg-elev px-1 rounded font-mono">Nome, UF</code>. Ex:</p>
                            <pre className="text-xs font-mono bg-elev rounded-md p-3 text-ink-muted leading-relaxed">Moema, SP{'\n'}Pinheiros, SP{'\n'}Campinas, SP</pre>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="imp-type" className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Importar como</label>
                                    <select id="imp-type" value={importType} onChange={e => setImportType(e.target.value as Location['type'])} className="w-full bg-elev border border-border rounded-md px-4 py-3 text-ink text-sm focus:ring-2 focus:ring-primary/30 outline-none">
                                        {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                                    </select>
                                </div>
                                {importType !== 'cidade' && (
                                    <div>
                                        <label htmlFor="imp-city" className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Cidade onde ficam</label>
                                        <input id="imp-city" type="text" value={importCity} onChange={e => setImportCity(e.target.value)} className="w-full bg-elev border border-border rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 outline-none" placeholder="São Paulo" />
                                    </div>
                                )}
                            </div>
                            <textarea rows={8} value={importText} onChange={e => setImportText(e.target.value)} className="w-full bg-elev border border-border rounded-md px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-primary/30 outline-none resize-y" placeholder="Moema, SP" aria-label="Lista de localidades" autoFocus />
                            {importError && <p role="alert" className="text-sm text-red-700 font-medium flex items-center gap-1.5"><AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />{importError}</p>}
                        </div>
                        <div className="p-6 border-t border-border flex gap-3 justify-end">
                            <button onClick={() => setIsImportOpen(false)} className="px-5 py-2.5 min-h-[44px] font-semibold text-ink-muted hover:bg-elev rounded transition-colors">Cancelar</button>
                            <button onClick={runImport} className="px-6 py-2.5 min-h-[44px] font-semibold bg-primary hover:brightness-90 text-surface rounded transition-all">Importar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
