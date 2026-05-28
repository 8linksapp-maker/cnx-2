/**
 * SettingsEmailList.tsx — Configurações do plugin Email List
 *
 * Segue o padrão do SettingsGSC.tsx:
 * - Lê/escreve pluginsConfig.json via githubApi
 * - SHA tracking para evitar conflitos
 * - Toast notifications
 */

import { useState, useEffect } from 'react';
import {
    Save, Loader2, AlertCircle, CheckCircle, Eye, EyeOff,
    Mail, Clock, ArrowDown, ToggleLeft, ToggleRight, PanelRight, FileText
} from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from '../../components/admin/CmsToaster';

const CONFIG_PATH = 'src/data/pluginsConfig.json';

export default function SettingsEmailList() {
    const [brevoApiKey, setBrevoApiKey] = useState('');
    const [brevoListId, setBrevoListId] = useState('');
    const [popupEnabled, setPopupEnabled] = useState(false);
    const [headline, setHeadline] = useState('Não perca nenhum artigo!');
    const [subheadline, setSubheadline] = useState('Receba os melhores conteúdos direto no seu e-mail.');
    const [triggerType, setTriggerType] = useState<'delay' | 'scroll'>('delay');
    const [triggerValue, setTriggerValue] = useState(5);
    const [showOnce, setShowOnce] = useState(true);

    const [sidebarEnabled, setSidebarEnabled] = useState(true);
    const [sidebarHeadline, setSidebarHeadline] = useState('Newsletter');
    const [sidebarSubheadline, setSidebarSubheadline] = useState('Junte-se a nossos leitores!');
    const [inlineEnabled, setInlineEnabled] = useState(false);
    const [inlineHeadline, setInlineHeadline] = useState('Gostando do conteúdo?');
    const [inlineSubheadline, setInlineSubheadline] = useState('Receba artigos como este direto no seu e-mail.');
    const [inlinePosition, setInlinePosition] = useState(3);

    const [showApiKey, setShowApiKey] = useState(false);
    const [fileSha, setFileSha] = useState('');
    const [fullConfig, setFullConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        githubApi('read', CONFIG_PATH)
            .then(data => {
                const config = JSON.parse(data.content);
                setFullConfig(config);
                setFileSha(data.sha);
                const el = config?.emailList ?? {};
                setBrevoApiKey(el.brevoApiKey ?? '');
                setBrevoListId(el.brevoListId ?? '');
                const popup = el.popup ?? {};
                setPopupEnabled(popup.enabled ?? false);
                setHeadline(popup.headline ?? 'Não perca nenhum artigo!');
                setSubheadline(popup.subheadline ?? 'Receba os melhores conteúdos direto no seu e-mail.');
                setTriggerType(popup.triggerType ?? 'delay');
                setTriggerValue(popup.triggerValue ?? 5);
                setShowOnce(popup.showOnce !== false);
                const sidebar = el.sidebar ?? {};
                setSidebarEnabled(sidebar.enabled !== false);
                setSidebarHeadline(sidebar.headline ?? 'Newsletter');
                setSidebarSubheadline(sidebar.subheadline ?? 'Junte-se a nossos leitores!');
                const inline = el.inline ?? {};
                setInlineEnabled(inline.enabled ?? false);
                setInlineHeadline(inline.headline ?? 'Gostando do conteúdo?');
                setInlineSubheadline(inline.subheadline ?? 'Receba artigos como este direto no seu e-mail.');
                setInlinePosition(inline.position ?? 3);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true); setSaved(false); setError('');
        triggerToast('Salvando configurações...', 'progress', 30);
        try {
            const updated = {
                ...fullConfig,
                emailList: {
                    brevoApiKey: brevoApiKey.trim(),
                    brevoListId: brevoListId.trim(),
                    popup: {
                        enabled: popupEnabled,
                        headline: headline.trim(),
                        subheadline: subheadline.trim(),
                        triggerType,
                        triggerValue: Number(triggerValue),
                        showOnce,
                    },
                    sidebar: {
                        enabled: sidebarEnabled,
                        headline: sidebarHeadline.trim(),
                        subheadline: sidebarSubheadline.trim(),
                    },
                    inline: {
                        enabled: inlineEnabled,
                        headline: inlineHeadline.trim(),
                        subheadline: inlineSubheadline.trim(),
                        position: Number(inlinePosition),
                    },
                    sequences: fullConfig?.emailList?.sequences ?? [],
                },
            };
            const res = await githubApi('write', CONFIG_PATH, {
                content: JSON.stringify(updated, null, 4),
                sha: fileSha,
                message: 'CMS: Update Email List settings',
            });
            setFileSha(res.sha ?? fileSha);
            setFullConfig(updated);
            setSaved(true);
            triggerToast('Configurações salvas!', 'success', 100);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            setError(err.message);
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleTestBrevo = async () => {
        if (!brevoApiKey.trim()) {
            setTestResult({ ok: false, message: 'Informe a API Key do Brevo antes de testar.' });
            return;
        }
        setTesting(true); setTestResult(null);
        try {
            const res = await fetch('/api/admin/plugins/email-list/test-brevo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: brevoApiKey.trim() }),
            });
            const data = await res.json();
            setTestResult({ ok: data.success, message: data.message });
        } catch {
            setTestResult({ ok: false, message: 'Erro de rede — verifique se o servidor está rodando.' });
        } finally {
            setTesting(false);
        }
    };

    const inputClass = 'w-full bg-surface border border-border rounded-md px-4 py-3 text-sm font-medium text-ink focus:outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/20 transition-all shadow-sm';
    const labelClass = 'block text-sm font-bold text-ink-muted uppercase tracking-wider mb-2 ml-1';

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-3xl border border-border">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p className="font-medium animate-pulse">Carregando configurações...</p>
        </div>
    );

    if (error && !fullConfig) return (
        <div className="bg-red-50 text-red-700 p-8 rounded-3xl border border-red-200 flex gap-4 items-start">
            <AlertCircle className="w-8 h-8 shrink-0" />
            <div><h3 className="text-xl font-bold mb-2">Erro de Leitura</h3><p>{error}</p></div>
        </div>
    );

    const activeCount = [popupEnabled, sidebarEnabled, inlineEnabled].filter(Boolean).length;

    return (
        <div className="max-w-2xl space-y-6">

            {/* Resumo do que está ativo */}
            <div className="bg-surface rounded-lg border border-border shadow-sm p-5">
                <p className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">O que está ativo agora</p>
                <div className="flex gap-3 flex-wrap mb-3">
                    {[
                        { label: 'Popup', active: popupEnabled },
                        { label: 'Sidebar', active: sidebarEnabled },
                        { label: 'Inline', active: inlineEnabled },
                    ].map(item => (
                        <div
                            key={item.label}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
                                item.active
                                    ? 'bg-primary-soft border-primary/30 text-primary'
                                    : 'bg-elev border-border text-ink-faint'
                            }`}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${item.active ? 'bg-primary' : 'bg-ink-faint'}`} />
                            {item.label}: {item.active ? 'ativo' : 'inativo'}
                        </div>
                    ))}
                </div>
                {activeCount > 1 && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                        Mais de um ponto de captura ativo pode irritar os visitantes. Considere usar apenas um por vez.
                    </div>
                )}
            </div>

            {/* Brevo */}
            <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                    <Mail className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-ink">Integração Brevo</h3>
                </div>

                <div className="space-y-4">
                    {/* API Key */}
                    <div>
                        <label className={labelClass}>API Key</label>
                        <div className="relative">
                            <input
                                type={showApiKey ? 'text' : 'password'}
                                value={brevoApiKey}
                                onChange={e => { setBrevoApiKey(e.target.value); setTestResult(null); }}
                                placeholder="xkeysib-..."
                                className={`${inputClass} pr-10 font-mono text-xs`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted transition-colors"
                            >
                                {showApiKey ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                            </button>
                        </div>
                        <p className="text-xs text-ink-faint mt-1 ml-1">
                            Encontre em Brevo → Configurações → API Keys.
                        </p>
                    </div>

                    {/* List ID */}
                    <div>
                        <label className={labelClass}>ID da Lista</label>
                        <input
                            type="text"
                            value={brevoListId}
                            onChange={e => setBrevoListId(e.target.value)}
                            placeholder="Ex: 3"
                            className={inputClass}
                        />
                        <p className="text-xs text-ink-faint mt-1 ml-1">
                            Todos os novos inscritos serão adicionados a esta lista no Brevo. Encontre o ID em Brevo → Contatos → Listas.
                        </p>
                    </div>
                </div>

                {/* Resultado do teste */}
                {testResult && (
                    <div className={`mt-4 p-3 rounded-md border flex items-start gap-3 text-sm ${testResult.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                        {testResult.ok
                            ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                        {testResult.message}
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleTestBrevo}
                    disabled={testing || !brevoApiKey.trim()}
                    className="mt-4 flex items-center gap-2 px-4 py-2 border border-border rounded-md text-sm font-medium text-ink hover:bg-elev disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : '🔌'}
                    {testing ? 'Testando...' : 'Testar Conexão'}
                </button>
            </div>

            {/* Popup config */}
            <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-ink">Popup de Captura</h3>
                    <button
                        type="button"
                        onClick={() => setPopupEnabled(v => !v)}
                        className="flex items-center gap-2 text-sm font-semibold transition-colors"
                    >
                        {popupEnabled
                            ? <><ToggleRight className="w-8 h-8 text-primary" /><span className="text-primary">Ativo</span></>
                            : <><ToggleLeft className="w-8 h-8 text-ink-faint" /><span className="text-ink-muted">Inativo</span></>
                        }
                    </button>
                </div>

                <div className={`space-y-4 transition-opacity ${popupEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div>
                        <label className={labelClass}>Título</label>
                        <input
                            type="text"
                            value={headline}
                            onChange={e => setHeadline(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Subtítulo</label>
                        <input
                            type="text"
                            value={subheadline}
                            onChange={e => setSubheadline(e.target.value)}
                            className={inputClass}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Tipo de Trigger</label>
                            <select
                                value={triggerType}
                                onChange={e => setTriggerType(e.target.value as 'delay' | 'scroll')}
                                className={inputClass}
                            >
                                <option value="delay">Após X segundos</option>
                                <option value="scroll">Ao chegar a X% da página</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>
                                {triggerType === 'delay' ? 'Segundos' : 'Porcentagem'}
                            </label>
                            <div className="relative">
                                {triggerType === 'delay'
                                    ? <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                                    : <ArrowDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                                }
                                <input
                                    type="number"
                                    min={1}
                                    max={triggerType === 'scroll' ? 100 : 300}
                                    value={triggerValue}
                                    onChange={e => setTriggerValue(Number(e.target.value))}
                                    className={`${inputClass} pl-9`}
                                />
                            </div>
                        </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={showOnce}
                            onChange={e => setShowOnce(e.target.checked)}
                            className="w-4 h-4 accent-primary rounded"
                        />
                        <span className="text-sm font-medium text-ink">
                            Mostrar apenas uma vez por visitante
                        </span>
                    </label>
                </div>

                {/* Preview do popup */}
                {popupEnabled && (
                    <div className="mt-5 p-4 bg-elev rounded-md border border-border">
                        <p className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-3">Preview</p>
                        <div className="bg-surface rounded-md p-5 shadow-sm max-w-xs mx-auto text-center border border-border">
                            <div style={{ width: 40, height: 40, background: 'rgb(139 74 54)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                <Mail className="w-5 h-5 text-white" />
                            </div>
                            <p className="font-bold text-ink text-sm mb-1">{headline || '...'}</p>
                            <p className="text-ink-muted text-xs leading-relaxed mb-3">{subheadline || '...'}</p>
                            <div className="space-y-2">
                                <div className="w-full h-9 bg-elev rounded-lg" />
                                <div className="w-full h-9 rounded-lg" style={{ background: 'rgb(139 74 54)' }} />
                            </div>
                            <p className="text-xs text-ink-faint mt-2">
                                {triggerType === 'delay'
                                    ? `Aparece após ${triggerValue}s`
                                    : `Aparece ao chegar a ${triggerValue}% da página${triggerValue === 50 ? ' — quando o visitante chega ao meio do artigo' : ''}`
                                }
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Sidebar widget config */}
            <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <PanelRight className="w-5 h-5 text-primary" />
                        <h3 className="font-bold text-ink">Widget da Sidebar</h3>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSidebarEnabled(v => !v)}
                        className="flex items-center gap-2 text-sm font-semibold transition-colors"
                    >
                        {sidebarEnabled
                            ? <><ToggleRight className="w-8 h-8 text-primary" /><span className="text-primary">Ativo</span></>
                            : <><ToggleLeft className="w-8 h-8 text-ink-faint" /><span className="text-ink-muted">Inativo</span></>
                        }
                    </button>
                </div>

                <div className={`space-y-4 transition-opacity ${sidebarEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div>
                        <label className={labelClass}>Título</label>
                        <input
                            type="text"
                            value={sidebarHeadline}
                            onChange={e => setSidebarHeadline(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Subtítulo</label>
                        <input
                            type="text"
                            value={sidebarSubheadline}
                            onChange={e => setSidebarSubheadline(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                </div>

                {sidebarEnabled && (
                    <div className="mt-5 p-4 bg-elev rounded-md border border-border">
                        <p className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-3">Preview</p>
                        <div className="bg-surface rounded-md p-4 shadow-sm max-w-xs mx-auto text-center border border-border">
                            <p className="font-bold text-ink text-sm mb-1">{sidebarHeadline || '...'}</p>
                            <p className="text-ink-muted text-xs mb-3">{sidebarSubheadline || '...'}</p>
                            <div className="space-y-2">
                                <div className="w-full h-8 bg-elev rounded-lg" />
                                <div className="w-full h-8 rounded-lg" style={{ background: 'rgb(139 74 54)' }} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Inline banner config */}
            <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        <h3 className="font-bold text-ink">Banner Inline nos Posts</h3>
                    </div>
                    <button
                        type="button"
                        onClick={() => setInlineEnabled(v => !v)}
                        className="flex items-center gap-2 text-sm font-semibold transition-colors"
                    >
                        {inlineEnabled
                            ? <><ToggleRight className="w-8 h-8 text-primary" /><span className="text-primary">Ativo</span></>
                            : <><ToggleLeft className="w-8 h-8 text-ink-faint" /><span className="text-ink-muted">Inativo</span></>
                        }
                    </button>
                </div>

                <div className={`space-y-4 transition-opacity ${inlineEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div>
                        <label className={labelClass}>Título</label>
                        <input
                            type="text"
                            value={inlineHeadline}
                            onChange={e => setInlineHeadline(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Subtítulo</label>
                        <input
                            type="text"
                            value={inlineSubheadline}
                            onChange={e => setInlineSubheadline(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Inserir após o parágrafo nº</label>
                        <input
                            type="number"
                            min={1}
                            max={20}
                            value={inlinePosition}
                            onChange={e => setInlinePosition(Number(e.target.value))}
                            className={inputClass}
                        />
                        <p className="text-xs text-ink-faint mt-1 ml-1">
                            O banner aparecerá após o {inlinePosition}º parágrafo do post.
                        </p>
                    </div>
                </div>

                {inlineEnabled && (
                    <div className="mt-5 p-4 bg-elev rounded-md border border-border">
                        <p className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-3">Preview</p>
                        <div className="bg-primary-soft border border-primary/30 rounded-md p-4 flex items-center gap-3">
                            <div style={{ flexShrink: 0, width: 36, height: 36, background: 'rgb(139 74 54)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Mail className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-ink text-sm truncate">{inlineHeadline || '...'}</p>
                                <p className="text-primary text-xs truncate">{inlineSubheadline || '...'}</p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <div className="h-8 w-28 bg-surface border border-primary/30 rounded-lg" />
                                <div className="h-8 w-20 rounded-lg" style={{ background: 'rgb(139 74 54)' }} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
            )}

            {/* Salvar */}
            <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary disabled:opacity-50 text-white px-6 py-2.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-none/20"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
                {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configurações'}
            </button>
        </div>
    );
}
