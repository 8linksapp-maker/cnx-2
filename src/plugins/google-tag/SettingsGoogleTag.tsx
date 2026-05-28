/**
 * SettingsGoogleTag.tsx — Plugin Google Tag (unified)
 *
 * UI to manage ALL Google tag IDs (Analytics G-, Ads AW-, Tag Manager GTM-, Display DC-)
 * in a single interface. Saves to pluginsConfig.json under googleTag.tags[].
 */

import { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, CheckCircle, Plus, Trash2, Tag } from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from '../../components/admin/CmsToaster';

const CONFIG_PATH = 'src/data/pluginsConfig.json';

const TAG_PREFIXES = ['G-', 'AW-', 'GTM-', 'DC-'];

function getTagType(id: string): { label: string; color: string; bg: string } {
    if (id.startsWith('G-'))   return { label: 'Analytics', color: 'text-green-700', bg: 'bg-green-100' };
    if (id.startsWith('AW-'))  return { label: 'Google Ads', color: 'text-amber-700', bg: 'bg-amber-100' };
    if (id.startsWith('GTM-')) return { label: 'Tag Manager', color: 'text-blue-700', bg: 'bg-blue-100' };
    if (id.startsWith('DC-'))  return { label: 'Display', color: 'text-purple-700', bg: 'bg-purple-100' };
    return { label: 'Outro', color: 'text-ink', bg: 'bg-elev' };
}

export default function SettingsGoogleTag() {
    const [tags, setTags] = useState<string[]>([]);
    const [savedTags, setSavedTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');
    const [fileSha, setFileSha] = useState('');
    const [fullConfig, setFullConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [validationError, setValidationError] = useState('');

    useEffect(() => {
        githubApi('read', CONFIG_PATH)
            .then(data => {
                const config = JSON.parse(data.content);
                setFullConfig(config);

                // Merge new config + legacy keys
                const existing: string[] = config?.googleTag?.tags || [];
                const legacyGA = config?.googleAnalytics?.measurementId || '';
                const legacyGTM = config?.googleTagManager?.containerId || '';
                const merged = [...new Set([...existing, ...(legacyGA ? [legacyGA] : []), ...(legacyGTM ? [legacyGTM] : [])])];
                setTags(merged);
                setSavedTags(merged);
                setFileSha(data.sha);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const addTag = () => {
        const trimmed = newTag.trim().toUpperCase();
        setValidationError('');

        if (!trimmed) return;

        if (!TAG_PREFIXES.some(p => trimmed.startsWith(p))) {
            setValidationError('O ID deve comecar com G-, AW-, GTM- ou DC-');
            return;
        }

        if (tags.includes(trimmed)) {
            setValidationError('Essa tag ja foi adicionada.');
            return;
        }

        setTags([...tags, trimmed]);
        setNewTag('');
    };

    const removeTag = (id: string) => {
        setTags(tags.filter(t => t !== id));
    };

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        setError('');
        triggerToast('Salvando configuracao do Google Tag...', 'progress', 30);
        try {
            // Build updated config: set googleTag.tags, remove legacy keys
            const { googleAnalytics, googleTagManager, ...rest } = fullConfig || {};
            const updated = {
                ...rest,
                googleTag: { tags },
            };
            const res = await githubApi('write', CONFIG_PATH, {
                content: JSON.stringify(updated, null, 4),
                sha: fileSha,
                message: 'CMS: Update Google Tag configuration',
            });
            setFileSha(res.sha || fileSha);
            setFullConfig(updated);
            setSavedTags(tags);
            setSaved(true);
            triggerToast('Google Tag configurado!', 'success', 100);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            setError(err.message);
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const inputClass = 'flex-1 bg-surface border border-border rounded-md px-4 py-3 text-sm font-medium text-ink focus:outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/20/20 transition-all shadow-sm font-mono';

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-3xl border border-border">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p className="font-medium animate-pulse">Carregando configuracao...</p>
        </div>
    );

    if (error && !fullConfig) return (
        <div className="bg-red-50 text-red-700 p-8 rounded-3xl border border-red-200 flex gap-4 items-start">
            <AlertCircle className="w-8 h-8 shrink-0" />
            <div><h3 className="text-xl font-bold mb-2">Erro de Leitura</h3><p>{error}</p></div>
        </div>
    );

    return (
        <div className="max-w-2xl space-y-6">
            {/* Tags list */}
            <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
                <h3 className="font-bold text-ink mb-1">Tags Configuradas</h3>
                <p className="text-sm text-ink-muted mb-4">
                    Adicione todos os IDs de tags do Google que deseja carregar no site.
                </p>

                {tags.length === 0 ? (
                    <div className="text-center py-8 text-ink-faint">
                        <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium text-ink-muted mb-1">Conecte o Google Analytics para ver as visitas do seu site.</p>
                        <a
                            href="https://support.google.com/analytics/answer/9304153"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary font-semibold hover:underline"
                        >
                            Como encontrar meu ID
                        </a>
                    </div>
                ) : (
                    <div className="space-y-2 mb-4">
                        {tags.map(id => {
                            const type = getTagType(id);
                            return (
                                <div key={id} className="flex items-center justify-between bg-elev rounded-md px-4 py-3 border border-border">
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono font-bold text-sm text-ink">{id}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${type.bg} ${type.color}`}>
                                            {type.label}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => removeTag(id)}
                                        className="p-1.5 text-ink-faint hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        title="Remover tag"
                                    >
                                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Add new tag */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newTag}
                        onChange={e => { setNewTag(e.target.value); setValidationError(''); }}
                        onKeyDown={e => e.key === 'Enter' && addTag()}
                        placeholder="G-XXXXXXXXXX, AW-XXXXXXXXXX ou GTM-XXXXXXX"
                        className={inputClass}
                    />
                    <button
                        onClick={addTag}
                        className="bg-primary hover:bg-primary text-white px-4 py-3 rounded-md text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-none/20 shrink-0"
                    >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        Adicionar
                    </button>
                </div>
                {validationError && (
                    <p className="text-xs text-amber-600 mt-2 ml-1">{validationError}</p>
                )}
            </div>

            {/* Status */}
            <div className="bg-elev rounded-lg border border-border p-4">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-muted">Status</span>
                    {tags.length > 0 ? (
                        <span className="flex items-center gap-1.5 text-green-600 font-semibold">
                            <CheckCircle className="w-4 h-4" aria-hidden="true" /> {tags.length} tag{tags.length !== 1 ? 's' : ''} configurada{tags.length !== 1 ? 's' : ''}
                        </span>
                    ) : (
                        <span className="text-ink-faint">Nenhuma tag configurada</span>
                    )}
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
            )}

            {/* Unsaved changes banner */}
            {JSON.stringify(tags) !== JSON.stringify(savedTags) && (
                <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    Mudanças não salvas — clique em Salvar para aplicar.
                </div>
            )}

            {/* Save button */}
            <button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary disabled:opacity-50 text-white px-6 py-3 rounded-md text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-none/20"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
                {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configuracao'}
            </button>

            {/* Instructions */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-5">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-3">Tipos de tag aceitos</p>
                <div className="space-y-3">
                    {[
                        { prefix: 'G-XXXXXXXX', label: 'Google Analytics', benefit: 'veja quantas pessoas visitam e de onde vêm' },
                        { prefix: 'AW-XXXXXXXX', label: 'Google Ads', benefit: 'meça os resultados das suas campanhas pagas' },
                        { prefix: 'GTM-XXXXXXX', label: 'Tag Manager', benefit: 'centralize todas as tags em um lugar' },
                        { prefix: 'DC-XXXXXXXX', label: 'Display & Video 360', benefit: 'tag de Floodlight para campanhas de display' },
                    ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm text-blue-800">
                            <span className="font-mono font-bold text-blue-600 shrink-0 w-28">{item.prefix}</span>
                            <div>
                                <span className="font-bold">{item.label}</span>
                                <span className="text-blue-600"> — {item.benefit}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
