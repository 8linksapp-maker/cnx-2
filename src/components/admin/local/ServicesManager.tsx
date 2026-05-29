import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2, Plus, Trash2, Wrench, X, Edit2, Sparkles, ArrowUp, ArrowDown, SlidersHorizontal } from 'lucide-react';
import { triggerToast } from '../CmsToaster';
import { githubApi } from '../../../lib/adminApi';
import { slugify } from '../../../lib/slugify';
import VariableField, { type VarDef } from './VariableField';
import ImageUploadField from './ImageUploadField';
import type { Service, Niche, Location, LocalBusiness, OutlineItem } from '../../../lib/localTypes';

const LEVELS: OutlineItem['level'][] = ['h2', 'h3', 'h4'];
const COLORS = ['#1c64c8', '#c5563e', '#3458a2', '#5f7436', '#c49838', '#8c344c', '#8b4a36', '#2f6d6a'];
const DEFAULT_COLOR = '#8b4a36';

export default function ServicesManager() {
    const [services, setServices] = useState<Service[]>([]);
    const [niches, setNiches] = useState<Niche[]>([]);
    const [biz, setBiz] = useState<LocalBusiness>({ companyName: '' });
    const [locations, setLocations] = useState<Location[]>([]);
    const [fileSha, setFileSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [tempTitle, setTempTitle] = useState('');
    const [tempSlug, setTempSlug] = useState('');
    const [slugTouched, setSlugTouched] = useState(false);
    const [tempShort, setTempShort] = useState('');
    const [tempIcon, setTempIcon] = useState('');
    const [tempColor, setTempColor] = useState(DEFAULT_COLOR);
    const [tempImage, setTempImage] = useState('');
    const [tempNiche, setTempNiche] = useState('');
    const [tempOutline, setTempOutline] = useState<OutlineItem[]>([]);
    const [tempContent, setTempContent] = useState('');
    const [tempGenAt, setTempGenAt] = useState('');
    const [tempActive, setTempActive] = useState(true);
    const [includeFaq, setIncludeFaq] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [mode, setMode] = useState<'auto' | 'avancado'>('auto');
    const [modalError, setModalError] = useState('');

    useEffect(() => {
        Promise.all([
            githubApi('read', 'src/data/services.json').catch(e => { if (e.message.includes('404')) return { content: '[]', sha: '' }; throw e; }),
            githubApi('read', 'src/data/nichos.json').catch(() => ({ content: '[]' })),
            githubApi('read', 'src/data/localBusiness.json').catch(() => ({ content: '{}' })),
            githubApi('read', 'src/data/locations.json').catch(() => ({ content: '[]' })),
        ])
            .then(([svc, nic, b, loc]) => {
                setServices(JSON.parse(svc?.content || '[]'));
                setFileSha(svc.sha || '');
                setNiches(JSON.parse(nic?.content || '[]'));
                setBiz(JSON.parse(b?.content || '{}'));
                setLocations(JSON.parse(loc?.content || '[]'));
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const nicheColorOf = (slug?: string) => niches.find(n => n.slug === slug)?.color;
    const effectiveColor = (s: Service) => s.color || nicheColorOf(s.niche) || DEFAULT_COLOR;

    // Exemplo realista pra prévia do campo inteligente.
    const exampleCity = locations.find(l => l.active !== false || l.type === 'cidade');
    const vars: VarDef[] = [
        { token: 'cidade', label: 'cidade', icon: '📍', example: exampleCity?.name || 'São Paulo' },
        { token: 'servico', label: 'serviço', icon: '🔧', example: tempTitle || 'o serviço' },
        { token: 'empresa', label: 'empresa', icon: '🏢', example: biz.companyName || 'sua empresa' },
        { token: 'telefone', label: 'telefone', icon: '📞', example: biz.phone || '(11) 0000-0000' },
        { token: 'estado', label: 'estado', icon: '🗺️', example: exampleCity?.state || 'SP' },
    ];

    const openCreate = () => {
        setTempTitle(''); setTempSlug(''); setTempShort(''); setTempIcon('');
        setTempColor(DEFAULT_COLOR); setTempImage(''); setTempNiche('');
        setTempOutline([]); setTempContent(''); setTempGenAt(''); setTempActive(true); setIncludeFaq(true); setMode('auto');
        setSlugTouched(false); setEditingIndex(null); setModalError('');
        setIsModalOpen(true);
    };
    const openEdit = (idx: number) => {
        const s = services[idx];
        setTempTitle(s.title); setTempSlug(s.slug); setTempShort(s.shortDescription || '');
        setTempIcon(s.icon || ''); setTempColor(effectiveColor(s)); setTempImage(s.image || '');
        setTempNiche(s.niche || ''); setTempOutline(s.outline ? [...s.outline] : []);
        setTempContent(s.generatedContent || ''); setTempGenAt(s.contentGeneratedAt || '');
        setTempActive(s.active !== false); setMode((s.outline?.length ?? 0) > 0 ? 'avancado' : 'auto');
        setSlugTouched(true); setEditingIndex(idx); setModalError('');
        setIsModalOpen(true);
    };
    const closeModal = () => { if (!generating) { setIsModalOpen(false); setModalError(''); } };

    useEffect(() => {
        if (!isModalOpen) return;
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !generating) closeModal(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isModalOpen, generating]);

    const handleTitleChange = (v: string) => { setTempTitle(v); if (!slugTouched) setTempSlug(slugify(v)); };
    const handleSlugChange = (v: string) => { setSlugTouched(true); setTempSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')); };

    const addOutline = () => setTempOutline([...tempOutline, { level: 'h2', text: '' }]);
    const updateOutline = (i: number, patch: Partial<OutlineItem>) => setTempOutline(tempOutline.map((o, k) => k === i ? { ...o, ...patch } : o));
    const removeOutline = (i: number) => setTempOutline(tempOutline.filter((_, k) => k !== i));
    const moveOutline = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= tempOutline.length) return;
        const arr = [...tempOutline]; [arr[i], arr[j]] = [arr[j], arr[i]]; setTempOutline(arr);
    };

    const generateWithAI = async () => {
        const title = tempTitle.trim();
        if (!title) { setModalError('Preencha o nome do serviço antes de gerar.'); return; }
        setGenerating(true); setModalError('');
        triggerToast('Gerando conteúdo com IA...', 'progress', 20);
        try {
            const res = await fetch('/api/admin/local/generate-content', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ servico: title, outline: tempOutline.filter(o => o.text.trim()), includeFaq }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Falha ao gerar');
            setTempContent(data.content || '');
            setTempGenAt(new Date().toISOString().split('T')[0]);
            triggerToast(data.usedAI ? 'Conteúdo gerado pela IA!' : 'Sem chave de IA — gerei um modelo de exemplo. Configure a IA para texto real.', data.usedAI ? 'success' : 'progress', 100);
        } catch (err: any) {
            setModalError(err.message || 'Não foi possível gerar o conteúdo.');
            triggerToast('Não foi possível gerar o conteúdo.', 'error');
        } finally { setGenerating(false); }
    };

    const saveArray = async (newList: Service[]) => {
        setSaving(true); setError('');
        triggerToast('Salvando serviços...', 'progress', 20);
        try {
            const data = await githubApi('write', 'src/data/services.json', {
                content: JSON.stringify(newList, null, 2), sha: fileSha || undefined, message: 'CMS: atualiza services.json',
            });
            setFileSha(data.sha);
            triggerToast('Serviços atualizados!', 'success', 100);
        } catch {
            setError('Não foi possível salvar os serviços. Verifique sua conexão.');
            triggerToast('Não foi possível salvar os serviços. Tente novamente.', 'error');
        } finally { setSaving(false); }
    };

    const saveModal = async () => {
        setModalError('');
        const title = tempTitle.trim();
        const slug = (tempSlug.trim() || slugify(title)).replace(/^-|-$/g, '');
        if (!title) { setModalError('Digite o nome do serviço.'); return; }
        if (!slug) { setModalError('O endereço (URL) é obrigatório.'); return; }

        const collision = services.find((s, i) => i !== editingIndex && (s.title === title || s.slug === slug));
        if (collision) { setModalError(`"${collision.title}" já existe. Escolha um nome ou endereço diferente.`); return; }

        const cleanOutline = tempOutline.map(o => ({ level: o.level, text: o.text.trim() })).filter(o => o.text);
        const entry: Service = {
            title, slug, color: tempColor, active: tempActive,
            ...(tempShort.trim() ? { shortDescription: tempShort.trim() } : {}),
            ...(tempIcon.trim() ? { icon: tempIcon.trim() } : {}),
            ...(tempImage.trim() ? { image: tempImage.trim() } : {}),
            ...(tempNiche ? { niche: tempNiche } : {}),
            ...(cleanOutline.length ? { outline: cleanOutline } : {}),
            ...(tempContent.trim() ? { generatedContent: tempContent.trim(), contentGeneratedAt: tempGenAt || new Date().toISOString().split('T')[0] } : {}),
        };
        const arr = editingIndex === null ? [...services, entry] : services.map((s, i) => i === editingIndex ? entry : s);
        setServices(arr); closeModal(); await saveArray(arr);
    };

    const removeService = async (idx: number) => {
        if (!confirm('Excluir este serviço? As páginas dele deixam de ser geradas na próxima publicação.')) return;
        const arr = services.filter((_, i) => i !== idx);
        setServices(arr); await saveArray(arr);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-lg border border-border">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p className="font-medium animate-pulse">Lendo serviços...</p>
        </div>
    );

    return (
        <div className="space-y-6 pb-32">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-ink">Serviços</h2>
                    <p className="text-sm text-ink-muted mt-0.5">Cada serviço vira uma página por cidade. {services.length} cadastrado{services.length === 1 ? '' : 's'}.</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {saving && <span className="flex items-center gap-2 text-ink-muted text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</span>}
                    <button onClick={openCreate} disabled={saving}
                        className="w-full sm:w-auto bg-primary hover:brightness-90 disabled:opacity-50 text-surface px-5 py-2.5 min-h-[44px] rounded font-semibold flex items-center justify-center gap-2 transition-all">
                        <Plus className="w-4 h-4" aria-hidden="true" /> Novo serviço
                    </button>
                </div>
            </div>

            {error && <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200 text-sm"><AlertCircle className="w-4 h-4 inline mr-2 -mt-0.5" />{error}</div>}

            {services.length === 0 ? (
                <div className="bg-elev border-2 border-dashed border-border rounded-lg p-16 flex flex-col items-center justify-center text-center">
                    <Wrench className="w-12 h-12 text-ink-faint mb-4" aria-hidden="true" />
                    <h3 className="text-lg font-bold text-ink mb-1">Nenhum serviço ainda</h3>
                    <p className="text-ink-muted mb-6">Crie um serviço, escolha a cor e gere o conteúdo com IA.</p>
                    <button onClick={openCreate} className="bg-primary text-surface font-semibold px-6 py-3 rounded hover:brightness-90 transition-all">Criar primeiro serviço</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {services.map((s, idx) => (
                        <div key={idx} className="bg-surface p-5 rounded-lg border border-border shadow-sm hover:shadow-md transition-all group">
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-md flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: effectiveColor(s) }} aria-hidden="true">{s.icon || '🔧'}</div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-ink truncate">{s.title}</p>
                                        <p className="text-[11px] font-mono text-ink-faint truncate">/{s.slug}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                                    <button onClick={() => openEdit(idx)} aria-label={`Editar serviço: ${s.title}`} className="p-2 min-h-[44px] min-w-[44px] text-ink-faint hover:text-ink-muted hover:bg-elev rounded transition-colors"><Edit2 className="w-4 h-4" aria-hidden="true" /></button>
                                    <button onClick={() => removeService(idx)} aria-label={`Excluir serviço: ${s.title}`} className="p-2 min-h-[44px] min-w-[44px] text-ink-faint hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
                                </div>
                            </div>
                            {s.shortDescription && <p className="text-xs text-ink-muted leading-relaxed line-clamp-2 mb-2">{s.shortDescription}</p>}
                            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wide">
                                {s.generatedContent ? <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Conteúdo pronto</span> : <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Sem conteúdo</span>}
                                {s.active === false && <span className="text-ink-faint bg-elev px-2 py-0.5 rounded">Inativo</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm" onClick={closeModal} aria-hidden="true">
                    <div role="dialog" aria-modal="true" aria-labelledby="modal-svc-title"
                        className="bg-surface rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ boxShadow: '0 20px 48px rgba(80,40,20,0.18)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
                            <h3 id="modal-svc-title" className="text-lg font-bold text-ink">{editingIndex !== null ? 'Editar serviço' : 'Novo serviço'}</h3>
                            <button onClick={closeModal} disabled={generating} aria-label="Fechar" className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-faint hover:text-ink hover:bg-elev rounded transition-colors disabled:opacity-40"><X className="w-5 h-5" aria-hidden="true" /></button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto">
                            <div className="grid grid-cols-[1fr_auto] gap-3">
                                <div>
                                    <label htmlFor="svc-title" className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Nome do serviço</label>
                                    <input id="svc-title" type="text" value={tempTitle} onChange={e => handleTitleChange(e.target.value)}
                                        className="w-full bg-elev border border-border rounded-md px-4 py-3 text-ink font-semibold focus:ring-2 focus:ring-primary/30 outline-none" placeholder="Ex: Aluguel de Andaime" autoFocus />
                                </div>
                                <div>
                                    <label htmlFor="svc-icon" className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Ícone</label>
                                    <input id="svc-icon" type="text" maxLength={2} value={tempIcon} onChange={e => setTempIcon(e.target.value)}
                                        className="w-16 text-center bg-elev border border-border rounded-md px-2 py-3 text-lg focus:ring-2 focus:ring-primary/30 outline-none" placeholder="🪜" aria-label="Emoji do serviço" />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="svc-slug" className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Endereço da página {!slugTouched && tempTitle && <span className="font-mono text-[9px] text-primary normal-case tracking-normal">(automático)</span>}</label>
                                <div className="flex items-stretch bg-elev border border-border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-primary/30">
                                    <span className="px-3 flex items-center font-mono text-xs text-ink-faint border-r border-border">/cidade/</span>
                                    <input id="svc-slug" type="text" value={tempSlug} onChange={e => handleSlugChange(e.target.value)}
                                        className="flex-1 bg-transparent px-3 py-3 text-ink font-mono text-sm outline-none" placeholder="aluguel-de-andaime" />
                                </div>
                            </div>

                            {/* Cor */}
                            <div>
                                <span className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Cor do serviço</span>
                                <div className="flex items-center gap-3">
                                    <input type="color" value={tempColor} onChange={e => setTempColor(e.target.value)} className="w-12 h-11 rounded border border-border bg-surface cursor-pointer p-1" aria-label="Seletor de cor" />
                                    <input type="text" value={tempColor} onChange={e => setTempColor(e.target.value)} className="w-28 bg-elev border border-border rounded-md px-3 py-3 text-ink font-mono text-sm uppercase focus:ring-2 focus:ring-primary/30 outline-none" aria-label="Código da cor" />
                                    <div className="flex flex-wrap gap-1.5">
                                        {COLORS.map(c => (
                                            <button key={c} type="button" onClick={() => setTempColor(c)} className="w-7 h-7 rounded-full border border-border hover:scale-110 transition-transform" style={{ backgroundColor: c }} aria-label={`Usar cor ${c}`} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <ImageUploadField value={tempImage} onChange={setTempImage} namePrefix={tempSlug || tempTitle || 'servico'}
                                label="Imagem do serviço" hint="Aparece no card e no topo da página. Opcional — sem imagem, usa a cor + ícone." />

                            <div>
                                <label htmlFor="svc-short" className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Descrição curta <span className="text-ink-faint normal-case tracking-normal">(opcional)</span></label>
                                <input id="svc-short" type="text" value={tempShort} onChange={e => setTempShort(e.target.value)} className="w-full bg-elev border border-border rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 outline-none" placeholder="Andaimes metálicos para obras e fachadas" />
                            </div>

                            {/* TEXTO DA PÁGINA — Automático (IA faz tudo) ou Avançado (define os tópicos) */}
                            <div>
                                <span className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">Texto da página</span>
                                <div role="tablist" aria-label="Como criar o texto" className="flex gap-1 bg-elev rounded-md p-1 w-fit">
                                    <button type="button" role="tab" aria-selected={mode === 'auto'} onClick={() => setMode('auto')}
                                        className={`flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded text-sm font-semibold transition-all ${mode === 'auto' ? 'bg-surface text-primary shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
                                        <Sparkles className="w-4 h-4" aria-hidden="true" /> Automático
                                    </button>
                                    <button type="button" role="tab" aria-selected={mode === 'avancado'} onClick={() => setMode('avancado')}
                                        className={`flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded text-sm font-semibold transition-all ${mode === 'avancado' ? 'bg-surface text-primary shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
                                        <SlidersHorizontal className="w-4 h-4" aria-hidden="true" /> Avançado
                                    </button>
                                </div>
                                <p className="text-xs text-ink-muted mt-2">
                                    {mode === 'auto'
                                        ? 'A IA escreve a página inteira pra você — é só clicar em gerar.'
                                        : 'Você define os tópicos que a página deve ter; a IA escreve seguindo eles.'}
                                </p>
                            </div>

                            {/* AVANÇADO — define os tópicos que guiam a IA */}
                            {mode === 'avancado' && (
                                <div className="rounded-lg border border-border bg-elev/40 p-4">
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                        <span className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Tópicos da página</span>
                                        <button type="button" onClick={addOutline} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0"><Plus className="w-3 h-3" aria-hidden="true" /> Adicionar tópico</button>
                                    </div>
                                    {tempOutline.length === 0 ? (
                                        <p className="text-xs text-ink-faint">Adicione os tópicos que a página deve cobrir (ex: "Por que escolher", "Como funciona"). A IA escreve cada um.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {tempOutline.map((o, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <select value={o.level} onChange={e => updateOutline(i, { level: e.target.value as OutlineItem['level'] })} className="bg-surface border border-border rounded px-2 py-2 text-xs font-mono uppercase focus:ring-2 focus:ring-primary/30 outline-none" aria-label={`Nível do tópico ${i + 1}`}>
                                                        {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                                    </select>
                                                    <input type="text" value={o.text} onChange={e => updateOutline(i, { text: e.target.value })} className="flex-1 bg-surface border border-border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none" placeholder="Ex: Por que escolher" aria-label={`Tópico ${i + 1}`} />
                                                    <button type="button" onClick={() => moveOutline(i, -1)} disabled={i === 0} className="p-1.5 text-ink-faint hover:text-ink disabled:opacity-30" aria-label="Mover para cima"><ArrowUp className="w-4 h-4" aria-hidden="true" /></button>
                                                    <button type="button" onClick={() => moveOutline(i, 1)} disabled={i === tempOutline.length - 1} className="p-1.5 text-ink-faint hover:text-ink disabled:opacity-30" aria-label="Mover para baixo"><ArrowDown className="w-4 h-4" aria-hidden="true" /></button>
                                                    <button type="button" onClick={() => removeOutline(i)} className="p-1.5 text-ink-faint hover:text-red-600" aria-label="Remover tópico"><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Gerar */}
                            <div className="flex flex-wrap items-center gap-3">
                                <button type="button" onClick={generateWithAI} disabled={generating}
                                    className="bg-primary hover:brightness-90 disabled:opacity-50 text-surface px-5 py-2.5 min-h-[44px] rounded font-semibold flex items-center gap-2 transition-all">
                                    {generating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Sparkles className="w-4 h-4" aria-hidden="true" />}
                                    {generating ? 'Gerando…' : (tempContent ? 'Gerar de novo' : 'Gerar texto com IA')}
                                </button>
                                <label className="flex items-center gap-1.5 text-xs text-ink-muted cursor-pointer">
                                    <input type="checkbox" checked={includeFaq} onChange={e => setIncludeFaq(e.target.checked)} className="w-3.5 h-3.5 accent-primary" /> incluir perguntas frequentes
                                </label>
                            </div>

                            {/* RESULTADO — texto gerado, editável */}
                            {tempContent ? (
                                <div>
                                    <span className="block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2">O texto {tempGenAt && <span className="text-ink-faint normal-case tracking-normal">· gerado {tempGenAt}</span>}</span>
                                    <VariableField value={tempContent} onChange={setTempContent} vars={vars} multiline rows={8} placeholder="O texto gerado aparece aqui." aria-label="Texto da página" />
                                    <p className="text-[10px] text-ink-faint mt-1.5">Pode ajustar à vontade. Os botões inserem cidade/empresa; a prévia mostra como fica.</p>
                                </div>
                            ) : (
                                <p className="text-sm text-ink-faint text-center bg-elev border border-dashed border-border rounded-md px-4 py-6">
                                    Clique em <strong className="text-ink-muted">Gerar texto com IA</strong> e a página é escrita pra você.
                                </p>
                            )}

                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <input type="checkbox" checked={tempActive} onChange={e => setTempActive(e.target.checked)} className="w-4 h-4 accent-primary" />
                                <span className="text-sm font-medium text-ink">Serviço ativo (gera páginas)</span>
                            </label>
                        </div>

                        {modalError && (
                            <div className="px-6 shrink-0"><p role="alert" className="text-sm text-red-700 font-medium flex items-center gap-1.5 py-2"><AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />{modalError}</p></div>
                        )}
                        <div className="p-6 border-t border-border flex gap-3 justify-end shrink-0">
                            <button onClick={closeModal} disabled={generating} className="px-5 py-2.5 min-h-[44px] font-semibold text-ink-muted hover:bg-elev rounded transition-colors disabled:opacity-40">Cancelar</button>
                            <button onClick={saveModal} disabled={generating} className="px-6 py-2.5 min-h-[44px] font-semibold bg-primary hover:brightness-90 text-surface rounded transition-all disabled:opacity-50">Salvar serviço</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
