import React, { useState, useEffect } from 'react';
import { Save, Loader2, LayoutTemplate } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

export default function SobreEditor() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [sobre, setSobre] = useState<any>(null);
    const [fileSha, setFileSha] = useState('');
    const [pendingUploads, setPendingUploads] = useState<Record<string, File>>({});

    useEffect(() => {
        githubApi('read', 'src/data/sobre.json')
            .then(data => { setSobre(JSON.parse(data?.content || "{}")); setFileSha(data.sha); })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setSaving(true); setError('');
        triggerToast('Sincronizando Página Sobre...', 'progress', 20);
        try {
            let finalJson = { ...sobre };
            for (const [keyPath, fileObj] of Object.entries(pendingUploads)) {
                const base64Content = await fileToBase64(fileObj);
                const fileExt = fileObj.name.split('.').pop() || 'jpg';
                const ghPath = `public/uploads/${Date.now()}-${keyPath}.${fileExt}`;
                await githubApi('write', ghPath, { content: base64Content, isBase64: true, message: `Upload imagem ${ghPath}` });
                const publicUrlPath = ghPath.replace('public', '');
                if (keyPath === 'heroImg') finalJson.hero.image = publicUrlPath;
                if (keyPath === 'seoImg') { if (!finalJson.seo) finalJson.seo = {}; finalJson.seo.image = publicUrlPath; }
            }
            const res = await githubApi('write', 'src/data/sobre.json', { content: JSON.stringify(finalJson, null, 2), sha: fileSha, message: 'CMS: Customização da Página Sobre' });
            setFileSha(res.sha); setSobre(finalJson); setPendingUploads({});
            triggerToast('Página Sobre atualizada com sucesso!', 'success', 100);
        } catch (err: any) {
            setError(err.message); triggerToast(`Erro: ${err.message}`, 'error');
        } finally { setSaving(false); }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, uiKey: string) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingUploads(prev => ({ ...prev, [uiKey]: file }));
        const previewUrl = URL.createObjectURL(file);
        if (uiKey === 'heroImg') setSobre({ ...sobre, hero: { ...sobre?.hero, image: previewUrl } });
        if (uiKey === 'seoImg') setSobre({ ...sobre, seo: { ...sobre?.seo, image: previewUrl } });
        e.target.value = '';
    };

    const updateField = (section: string, key: string, value: string) => {
        setSobre({ ...sobre, [section]: { ...(sobre[section] || {}), [key]: value } });
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-32 text-ink-faint bg-surface rounded-lg border border-border">
            <LayoutTemplate className="w-10 h-10 animate-pulse mb-6 text-ink-faint" />
            <p className="font-semibold text-sm animate-pulse text-ink-muted">Buscando sobre.json...</p>
        </div>
    );

    const cardClass = "p-8 mb-6 bg-surface border border-border rounded-lg shadow-sm";
    const inputClass = "w-full bg-surface border border-border rounded-md px-4 py-3 text-sm font-medium text-ink focus:outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/20/20 transition-all shadow-sm";
    const labelClass = "block text-sm font-bold text-ink-muted uppercase tracking-wider mb-2 ml-1";

    return (
        <div className="max-w-4xl space-y-0 pb-32">
            {/* Action bar */}
            <div className="flex items-center justify-between bg-surface p-4 px-6 rounded-lg border border-border shadow-sm mb-6">
                <div>
                    <h2 className="text-lg font-bold text-ink">Editar Página: Sobre Nós</h2>
                    <p className="text-xs text-ink-muted mt-0.5">Edita o arquivo <code className="bg-elev px-1 rounded">src/data/sobre.json</code></p>
                </div>
                <button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium mb-4">{error}</div>}

            <form onSubmit={handleSave} className="space-y-6">
                <div className={cardClass}>
                    <h3 className="text-lg font-bold text-ink mb-6 border-b border-border pb-4">1. Banner da História (Hero)</h3>
                    <div className="space-y-4">
                        <div><label className={labelClass}>Título Principal (H1)</label><input type="text" value={sobre?.hero?.title || ''} onChange={e => updateField('hero', 'title', e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>Parágrafo Descritivo</label><textarea rows={4} value={sobre?.hero?.desc || ''} onChange={e => updateField('hero', 'desc', e.target.value)} className={`${inputClass} resize-y`} /></div>
                        <div className="bg-elev p-4 border border-border rounded-md">
                            <label className={labelClass}>Foto da Empresa</label>
                            <input type="file" accept="image/*" aria-label="Selecionar foto da empresa ou equipe" className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary-soft file:text-primary hover:file:bg-primary-soft cursor-pointer" onChange={e => handleFileSelect(e, 'heroImg')} />
                            {pendingUploads['heroImg'] && <span className="text-[10px] bg-elev text-ink px-2 py-1 rounded font-bold uppercase mt-2 inline-block">Upload Pendente</span>}
                            {sobre?.hero?.image && <div className="mt-4 w-full h-[200px] border border-border rounded overflow-hidden"><img src={sobre?.hero?.image} className="w-full h-full object-cover" /></div>}
                        </div>
                    </div>
                </div>

                <div className={cardClass}>
                    <h3 className="text-lg font-bold text-ink mb-6 border-b border-border pb-4">2. Conteúdo da História</h3>
                    <div className="space-y-4">
                        <div><label className={labelClass}>Título da Missão</label><input type="text" value={sobre?.content?.missionTitle || ''} onChange={e => updateField('content', 'missionTitle', e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>Texto da Missão</label><textarea rows={4} value={sobre?.content?.missionText || ''} onChange={e => updateField('content', 'missionText', e.target.value)} className={`${inputClass} resize-y`} /></div>
                        <hr className="border-border" />
                        <div><label className={labelClass}>Título da Equipe</label><input type="text" value={sobre?.content?.teamTitle || ''} onChange={e => updateField('content', 'teamTitle', e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>Texto da Equipe</label><textarea rows={4} value={sobre?.content?.teamText || ''} onChange={e => updateField('content', 'teamText', e.target.value)} className={`${inputClass} resize-y`} /></div>
                    </div>
                </div>

                <div className={cardClass}>
                    <h3 className="text-lg font-bold text-ink mb-6 border-b border-border pb-4">SEO</h3>
                    <div className="space-y-4">
                        <div><label className={labelClass}>Título SEO</label><input type="text" value={sobre?.seo?.title || ''} onChange={e => updateField('seo', 'title', e.target.value)} className={inputClass} placeholder="Sobre Nós | Nome do Site" /></div>
                        <div><label className={labelClass}>Meta Descrição</label><textarea rows={3} value={sobre?.seo?.description || ''} onChange={e => updateField('seo', 'description', e.target.value)} className={`${inputClass} resize-y text-xs`} /></div>
                        <div>
                            <label className={labelClass}>Imagem Social (Open Graph)</label>
                            <input type="file" accept="image/*" aria-label="Selecionar imagem para compartilhamento social (Open Graph)" onChange={e => handleFileSelect(e, 'seoImg')} className="text-[10px] w-full file:mr-2 file:py-1 file:px-2 file:border-0 file:bg-primary-soft file:text-primary" />
                            {sobre?.seo?.image && <img src={sobre?.seo?.image} className="w-full aspect-video object-cover mt-3 rounded" />}
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
