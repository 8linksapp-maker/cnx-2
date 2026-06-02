import React, { useState, useEffect } from 'react';
import { Loader2, Layers, Plus, X } from 'lucide-react';
import { triggerToast } from '../CmsToaster';
import { githubApi } from '../../../lib/adminApi';

/**
 * Editor do modelo das páginas de serviço (src/data/localTemplate.json).
 * Esse modelo é aplicado a TODAS as páginas serviço × cidade — as variáveis
 * ({servico}, {cidade}, {estado}, {empresa}, {telefone}) são trocadas por página.
 */
const VARS = ['{servico}', '{cidade}', '{estado}', '{empresa}', '{telefone}'];

export default function LocalTemplateEditor() {
    const [tpl, setTpl] = useState<any>(null);
    const [fileSha, setFileSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        githubApi('read', 'src/data/localTemplate.json')
            .then(d => { setTpl(JSON.parse(d?.content || '{}')); setFileSha(d.sha); })
            .catch(() => { setTpl({}); })
            .finally(() => setLoading(false));
    }, []);

    const set = (k: string, v: any) => setTpl({ ...tpl, [k]: v });
    const setBenefit = (i: number, v: string) => { const b = [...(tpl.benefits || [])]; b[i] = v; set('benefits', b); };
    const addBenefit = () => set('benefits', [...(tpl.benefits || []), '']);
    const removeBenefit = (i: number) => set('benefits', (tpl.benefits || []).filter((_: any, j: number) => j !== i));

    const save = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setSaving(true); setError('');
        triggerToast('Salvando modelo das páginas...', 'progress', 20);
        try {
            const clean = { ...tpl, benefits: (tpl.benefits || []).filter((b: string) => b && b.trim()) };
            const res = await githubApi('write', 'src/data/localTemplate.json', { content: JSON.stringify(clean, null, 2), sha: fileSha, message: 'CMS: modelo das páginas de serviço' });
            setFileSha(res.sha); setTpl(clean);
            triggerToast('Modelo salvo!', 'success', 100);
        } catch (err: any) {
            setError(err.message); triggerToast(`Erro: ${err.message}`, 'error');
        } finally { setSaving(false); }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-32 text-ink-faint bg-surface rounded-lg border border-border">
            <Layers className="w-10 h-10 animate-pulse mb-6 text-ink-faint" />
            <p className="font-semibold text-sm animate-pulse text-ink-muted">Buscando localTemplate.json...</p>
        </div>
    );

    const cardClass = "p-8 mb-6 bg-surface border border-border rounded-lg shadow-sm";
    const inputClass = "w-full bg-surface border border-border rounded-md px-4 py-3 text-sm font-medium text-ink focus:outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/20 transition-all shadow-sm";
    const labelClass = "block text-sm font-bold text-ink-muted uppercase tracking-wider mb-2 ml-1";

    return (
        <div className="max-w-4xl pb-32">
            <div className="flex items-center justify-between bg-surface p-4 px-6 rounded-lg border border-border shadow-sm mb-6">
                <div>
                    <h2 className="text-lg font-bold text-ink">Modelo das páginas de serviço</h2>
                    <p className="text-xs text-ink-muted mt-0.5">Rege todas as páginas serviço × cidade — edita <code className="bg-elev px-1 rounded">localTemplate.json</code></p>
                </div>
                <button onClick={() => save()} disabled={saving} className="bg-primary hover:bg-primary disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium mb-4">{error}</div>}

            <div className="bg-primary-soft border border-primary/20 rounded-lg p-4 px-5 mb-6">
                <p className="text-sm text-ink font-semibold mb-2">Variáveis disponíveis</p>
                <p className="text-xs text-ink-muted mb-3">Use estas variáveis nos textos abaixo — elas são trocadas automaticamente em cada página (ex: {'{cidade}'} vira "Moema").</p>
                <div className="flex flex-wrap gap-2">
                    {VARS.map(v => <code key={v} className="text-xs font-mono bg-surface border border-border px-2 py-1 rounded text-primary">{v}</code>)}
                </div>
            </div>

            <form onSubmit={save} className="space-y-6">
                <div className={cardClass}>
                    <h3 className="text-lg font-bold text-ink mb-6 border-b border-border pb-4">1. Chamada de Topo (Hero)</h3>
                    <div className="space-y-4">
                        <div><label className={labelClass}>Título (H1)</label><input type="text" value={tpl?.heroTitle || ''} onChange={e => set('heroTitle', e.target.value)} className={inputClass} placeholder="{servico} em {cidade} - {estado}" /></div>
                        <div><label className={labelClass}>Subtítulo</label><textarea rows={2} value={tpl?.heroSubtitle || ''} onChange={e => set('heroSubtitle', e.target.value)} className={`${inputClass} resize-y`} placeholder="Atendimento profissional de {servico} em {cidade}." /></div>
                    </div>
                </div>

                <div className={cardClass}>
                    <h3 className="text-lg font-bold text-ink mb-2 border-b border-border pb-4">2. Conteúdo base</h3>
                    <p className="text-xs text-ink-muted mb-4">Texto-padrão da página. Usado quando o serviço não tem um conteúdo próprio (em Serviços → conteúdo). Aceita Markdown.</p>
                    <textarea rows={8} value={tpl?.pageContent || ''} onChange={e => set('pageContent', e.target.value)} className={`${inputClass} resize-y font-mono text-xs leading-relaxed`} placeholder="Procurando {servico} em {cidade}? A {empresa}..." />
                </div>

                <div className={cardClass}>
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
                        <h3 className="text-lg font-bold text-ink">3. Benefícios</h3>
                        <button type="button" onClick={addBenefit} className="inline-flex items-center gap-1.5 text-xs font-bold bg-primary-soft text-primary px-3 py-1.5 rounded hover:brightness-95 transition-all"><Plus className="w-3.5 h-3.5" /> Adicionar</button>
                    </div>
                    <div className="space-y-3">
                        {(tpl?.benefits || []).length === 0 && <p className="text-sm text-ink-faint">Nenhum benefício. Clique em "Adicionar".</p>}
                        {(tpl?.benefits || []).map((b: string, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                                <input type="text" value={b} onChange={e => setBenefit(i, e.target.value)} className={inputClass} placeholder="Ex: Atendimento rápido em {cidade}" />
                                <button type="button" onClick={() => removeBenefit(i)} aria-label="Remover benefício" className="shrink-0 w-10 h-10 flex items-center justify-center rounded text-ink-faint hover:text-red-600 hover:bg-red-50 transition-colors"><X className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={cardClass}>
                    <h3 className="text-lg font-bold text-ink mb-6 border-b border-border pb-4">4. SEO (meta tags)</h3>
                    <div className="space-y-4">
                        <div><label className={labelClass}>Título SEO</label><input type="text" value={tpl?.metaTitle || ''} onChange={e => set('metaTitle', e.target.value)} className={inputClass} placeholder="{servico} em {cidade} | {empresa}" /></div>
                        <div><label className={labelClass}>Meta Descrição</label><textarea rows={3} value={tpl?.metaDescription || ''} onChange={e => set('metaDescription', e.target.value)} className={`${inputClass} resize-y`} placeholder="Precisa de {servico} em {cidade}? Orçamento grátis..." /></div>
                    </div>
                </div>
            </form>
        </div>
    );
}
