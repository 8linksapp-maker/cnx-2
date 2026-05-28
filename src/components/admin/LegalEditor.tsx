import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, Loader2, Plus, Trash2, FileText, X, ChevronDown, ChevronUp } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

interface LegalSection { title: string; text: string; }
interface LegalData { title: string; lastUpdated: string; content: LegalSection[]; }

export default function LegalEditor() {
    const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>('privacy');
    const [privacyData, setPrivacyData] = useState<LegalData | null>(null);
    const [termsData, setTermsData] = useState<LegalData | null>(null);
    const [privacySha, setPrivacySha] = useState('');
    const [termsSha, setTermsSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetch = async () => {
            try {
                const [privRes, termsRes] = await Promise.allSettled([
                    githubApi('read', 'src/data/privacy.json'),
                    githubApi('read', 'src/data/terms.json'),
                ]);
                if (privRes.status === 'fulfilled') { setPrivacyData(JSON.parse(privRes.value?.content || "{}")); setPrivacySha(privRes.value.sha); }
                if (termsRes.status === 'fulfilled') { setTermsData(JSON.parse(termsRes.value?.content || "{}")); setTermsSha(termsRes.value.sha); }
            } catch (err: any) {
                setError('Erro ao carregar dados. Verifique se os arquivos existem no repositório.');
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    const handleSave = async (type: 'privacy' | 'terms') => {
        setSaving(true);
        const data = type === 'privacy' ? privacyData : termsData;
        const sha = type === 'privacy' ? privacySha : termsSha;
        const path = type === 'privacy' ? 'src/data/privacy.json' : 'src/data/terms.json';
        if (!data) return;

        const updatedData = { ...data, lastUpdated: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) };
        triggerToast(`Salvando ${type === 'privacy' ? 'Privacidade' : 'Termos'}...`, 'progress', 30);

        try {
            const res = await githubApi('write', path, { content: JSON.stringify(updatedData, null, 2), sha: sha || undefined, message: `CMS: Update ${path}` });
            if (type === 'privacy') { setPrivacySha(res.sha); setPrivacyData(updatedData); }
            else { setTermsSha(res.sha); setTermsData(updatedData); }
            triggerToast('Alterações salvas com sucesso!', 'success', 100);
        } catch (err: any) {
            triggerToast(err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const updateSection = (type: 'privacy' | 'terms', index: number, field: keyof LegalSection, value: string) => {
        const setData = type === 'privacy' ? setPrivacyData : setTermsData;
        const currentData = type === 'privacy' ? privacyData : termsData;
        if (!currentData) return;
        const newContent = [...currentData.content];
        newContent[index] = { ...newContent[index], [field]: value };
        setData({ ...currentData, content: newContent });
    };

    const addSection = (type: 'privacy' | 'terms') => {
        const setData = type === 'privacy' ? setPrivacyData : setTermsData;
        const currentData = type === 'privacy' ? privacyData : termsData;
        if (!currentData) return;
        setData({ ...currentData, content: [...currentData.content, { title: 'Nova Seção', text: 'Conteúdo aqui...' }] });
    };

    const removeSection = (type: 'privacy' | 'terms', index: number) => {
        if (!confirm('Excluir esta seção?')) return;
        const setData = type === 'privacy' ? setPrivacyData : setTermsData;
        const currentData = type === 'privacy' ? privacyData : termsData;
        if (!currentData) return;
        setData({ ...currentData, content: currentData.content.filter((_: any, i: number) => i !== index) });
    };

    const moveSection = (type: 'privacy' | 'terms', index: number, direction: 'up' | 'down') => {
        const setData = type === 'privacy' ? setPrivacyData : setTermsData;
        const currentData = type === 'privacy' ? privacyData : termsData;
        if (!currentData) return;
        const newContent = [...currentData.content];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= newContent.length) return;
        [newContent[index], newContent[newIndex]] = [newContent[newIndex], newContent[index]];
        setData({ ...currentData, content: newContent });
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-32 text-ink-faint bg-surface rounded-md border border-border">
            <FileText className="w-10 h-10 animate-pulse mb-6 text-ink-faint" />
            <p className="font-semibold text-sm animate-pulse text-ink-muted">Buscando dados do repositório Git...</p>
        </div>
    );

    const currentData = activeTab === 'privacy' ? privacyData : termsData;

    return (
        <div className="space-y-6 pb-32">
            {/* Tabs */}
            <div className="flex items-center justify-between bg-surface p-4 rounded-lg border border-border shadow-sm">
                <div role="tablist" aria-label="Documentos legais" className="flex p-1 bg-elev rounded-md w-fit border border-border">
                    <button
                        role="tab"
                        aria-selected={activeTab === 'privacy'}
                        aria-controls="tab-panel-legal"
                        id="tab-privacy"
                        onClick={() => setActiveTab('privacy')}
                        className={`px-4 py-2 min-h-[44px] rounded text-xs font-bold transition-all ${activeTab === 'privacy' ? 'bg-surface text-ink shadow-sm border border-border' : 'text-ink-muted hover:text-ink'}`}
                    >
                        Política de Privacidade
                    </button>
                    <button
                        role="tab"
                        aria-selected={activeTab === 'terms'}
                        aria-controls="tab-panel-legal"
                        id="tab-terms"
                        onClick={() => setActiveTab('terms')}
                        className={`px-4 py-2 min-h-[44px] rounded text-xs font-bold transition-all ${activeTab === 'terms' ? 'bg-surface text-ink shadow-sm border border-border' : 'text-ink-muted hover:text-ink'}`}
                    >
                        Termos de Uso
                    </button>
                </div>
                <button onClick={() => handleSave(activeTab)} disabled={saving}
                    className="bg-primary hover:bg-primary disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>

            {error && <div className="p-5 bg-red-100/50 text-red-700 rounded-lg font-bold border border-red-200"><AlertCircle className="w-5 h-5 inline mr-2 -mt-1" /> {error}</div>}

            {currentData ? (
                <div
                    id="tab-panel-legal"
                    role="tabpanel"
                    aria-labelledby={activeTab === 'privacy' ? 'tab-privacy' : 'tab-terms'}
                    className="space-y-4"
                >
                    {currentData.content.map((section, idx) => (
                        <div key={idx} className="bg-surface p-6 rounded-lg border border-border shadow-sm group">
                            <div className="flex items-center justify-between mb-4 border-b border-border pb-4">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span aria-hidden="true" className="w-8 h-8 rounded-md bg-elev flex items-center justify-center text-ink-muted font-bold text-xs shrink-0">#{idx + 1}</span>
                                    <input
                                        type="text"
                                        value={section.title}
                                        onChange={(e) => updateSection(activeTab, idx, 'title', e.target.value)}
                                        aria-label={`Título da seção ${idx + 1}`}
                                        className="text-sm font-bold text-ink bg-transparent border-none focus:ring-0 w-full focus:outline-none"
                                        placeholder="Título da Seção"
                                    />
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                                    <button onClick={() => moveSection(activeTab, idx, 'up')} disabled={idx === 0} aria-label={`Mover seção ${idx + 1} para cima`} className="p-2 min-h-[44px] min-w-[44px] text-ink-faint hover:text-primary hover:bg-primary-soft rounded transition-colors disabled:opacity-30"><ChevronUp className="w-4 h-4" aria-hidden="true" /></button>
                                    <button onClick={() => moveSection(activeTab, idx, 'down')} disabled={idx === currentData.content.length - 1} aria-label={`Mover seção ${idx + 1} para baixo`} className="p-2 min-h-[44px] min-w-[44px] text-ink-faint hover:text-primary hover:bg-primary-soft rounded transition-colors disabled:opacity-30"><ChevronDown className="w-4 h-4" aria-hidden="true" /></button>
                                    <button onClick={() => removeSection(activeTab, idx)} aria-label={`Excluir seção ${idx + 1}: ${section.title}`} className="p-2 min-h-[44px] min-w-[44px] text-ink-faint hover:text-red-600 hover:bg-red-50 rounded ml-2 transition-colors"><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
                                </div>
                            </div>
                            <textarea value={section.text} onChange={(e) => updateSection(activeTab, idx, 'text', e.target.value)} rows={6}
                                className="w-full bg-surface border border-border rounded-md px-4 py-3 text-ink text-base leading-relaxed focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/20 transition-colors resize-none shadow-sm"
                                placeholder="Escreva o texto jurídico aqui..." />
                        </div>
                    ))}
                    <button onClick={() => addSection(activeTab)} className="w-full py-8 border-2 border-dashed border-border rounded-md text-ink-muted hover:text-primary hover:border-primary hover:bg-primary-soft transition-all font-bold flex flex-col items-center justify-center gap-2 text-xs uppercase">
                        <Plus className="w-6 h-6" /> Adicionar Nova Seção
                    </button>
                </div>
            ) : (
                <div className="p-10 bg-red-50 border border-red-100 rounded-lg text-red-700 flex items-center gap-4">
                    <AlertCircle className="w-8 h-8" />
                    <div>
                        <p className="font-bold text-lg">Arquivo não encontrado</p>
                        <p className="text-sm opacity-80">Não foi possível localizar o arquivo JSON no repositório.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
