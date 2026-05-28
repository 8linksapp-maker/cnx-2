/**
 * SettingsAI.tsx — Plugin AI Generator (Walker)
 *
 * UI para configurar provedor de IA e API Keys.
 * Salva em src/data/pluginsConfig.json via githubApi().
 * Adaptado do CNX para o estilo visual do Walker.
 */

import { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from '../../components/admin/CmsToaster';

type AIProvider = 'openai' | 'gemini';

const CONFIG_PATH = 'src/data/pluginsConfig.json';

const PROVIDERS = [
    {
        id: 'gemini' as AIProvider,
        name: 'Google Gemini',
        badge: 'GRATUITO',
        badgeClass: 'bg-green-100 text-green-700',
        description: 'Gemini 1.5 Flash — generoso plano gratuito, ideal para começar.',
        docsUrl: 'https://aistudio.google.com/app/apikey',
        docsLabel: 'Obter chave gratuita no Google AI Studio',
        placeholder: 'AIzaSy...',
    },
    {
        id: 'openai' as AIProvider,
        name: 'OpenAI',
        badge: 'PAGO',
        badgeClass: 'bg-amber-100 text-amber-700',
        description: 'GPT-4o Mini — alta qualidade, requer saldo na conta OpenAI.',
        docsUrl: 'https://platform.openai.com/api-keys',
        docsLabel: 'Obter chave na plataforma OpenAI',
        placeholder: 'sk-...',
    },
];

const STEP_LABELS = [
    'Escolha o provedor',
    'Cole sua chave',
    'Teste a conexão',
    'Salve',
];

export default function SettingsAI() {
    const [provider, setProvider] = useState<AIProvider>('gemini');
    const [apiKey, setApiKey] = useState('');
    const [pexelsApiKey, setPexelsApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [showPexelsKey, setShowPexelsKey] = useState(false);
    const [fileSha, setFileSha] = useState('');
    const [fullConfig, setFullConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [testedInSession, setTestedInSession] = useState(false);

    useEffect(() => {
        githubApi('read', CONFIG_PATH)
            .then(data => {
                const config = JSON.parse(data.content);
                setFullConfig(config);
                setFileSha(data.sha);
                const ai = config?.ai || {};
                setProvider(ai.provider || 'gemini');
                setApiKey(ai.apiKey || '');
                setPexelsApiKey(ai.pexelsApiKey || '');
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        setError('');
        triggerToast('Salvando configurações de IA...', 'progress', 30);
        try {
            const updated = {
                ...fullConfig,
                ai: { provider, apiKey: apiKey.trim(), pexelsApiKey: pexelsApiKey.trim() },
            };
            const res = await githubApi('write', CONFIG_PATH, {
                content: JSON.stringify(updated, null, 4),
                sha: fileSha,
                message: 'CMS: Update AI settings',
            });
            setFileSha(res.sha || fileSha);
            setFullConfig(updated);
            setSaved(true);
            triggerToast('Configurações de IA salvas!', 'success', 100);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            setError(err.message);
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (!apiKey.trim()) {
            setTestResult({ ok: false, message: 'Insira uma API Key antes de testar.' });
            return;
        }
        setTesting(true);
        setTestResult(null);
        try {
            const res = await fetch('/api/admin/plugins/ai/test-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, apiKey: apiKey.trim() }),
            });
            const data = await res.json();
            setTestResult({ ok: data.success, message: data.message });
            if (data.success) setTestedInSession(true);
        } catch {
            setTestResult({ ok: false, message: 'Erro ao testar — verifique se o servidor está rodando.' });
        } finally {
            setTesting(false);
        }
    };

    const inputClass = 'w-full bg-surface border border-border rounded-md px-4 py-3 text-sm font-medium text-ink focus:outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/20/20 transition-all shadow-sm';
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

    const currentProvider = PROVIDERS.find(p => p.id === provider)!;
    const keyIsEmpty = !apiKey.trim();

    return (
        <div className="max-w-2xl space-y-6">

            {/* Banner: chave vazia */}
            {keyIsEmpty && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 text-center">
                    <p className="font-bold text-amber-800 text-sm">O Gerador de Posts está desativado</p>
                    <p className="text-amber-700 text-xs mt-1">Configure uma chave de API para começar a gerar conteúdo.</p>
                </div>
            )}

            {/* Aviso de segurança */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="font-bold text-red-800 text-sm mb-1">Atenção: esta chave dá acesso pago à IA.</p>
                <p className="text-red-700 text-xs leading-relaxed">
                    Se alguém tiver acesso ao seu repositório GitHub, poderá usar sua chave e gerar cobranças na sua conta.
                    Confirme que seu repositório está configurado como <strong>Privado</strong> antes de continuar.
                </p>
            </div>

            {/* Indicador de passos */}
            <div className="bg-surface rounded-lg border border-border shadow-sm p-4">
                <p className="text-xs font-bold text-ink-faint uppercase tracking-widest mb-3">Como configurar</p>
                <ol className="flex flex-wrap gap-x-4 gap-y-2">
                    {STEP_LABELS.map((label, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs text-ink-muted">
                            <span className="w-5 h-5 rounded-full bg-elev text-ink-faint flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                            {label}
                        </li>
                    ))}
                </ol>
            </div>

            {/* Passo 1: Seleção de provedor */}
            <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
                <p className={labelClass}>1. Provedor de IA</p>
                <div className="grid grid-cols-2 gap-3">
                    {PROVIDERS.map(p => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => { setProvider(p.id); setTestResult(null); setTestedInSession(false); }}
                            className={`p-4 rounded-md border-2 text-left transition-all ${provider === p.id ? 'border-primary/80 bg-primary-soft' : 'border-border hover:border-border'}`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-ink text-sm">{p.name}</span>
                                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${p.badgeClass}`}>{p.badge}</span>
                            </div>
                            <p className="text-xs text-ink-muted">{p.description}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Passo 2: API Key */}
            <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                    <p className={labelClass}>2. API Key — {currentProvider.name}</p>
                    <a href={currentProvider.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        {currentProvider.docsLabel} ↗
                    </a>
                </div>
                <div className="relative">
                    <input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={e => { setApiKey(e.target.value); setTestResult(null); setTestedInSession(false); }}
                        placeholder={currentProvider.placeholder}
                        className={`${inputClass} font-mono pr-12`}
                    />
                    <button
                        type="button"
                        onClick={() => setShowKey(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted transition-colors"
                    >
                        {showKey ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                    </button>
                </div>
                {apiKey && (
                    <p className="text-xs text-ink-faint mt-1 ml-1">{apiKey.length} caracteres</p>
                )}
            </div>

            {/* Pexels API Key */}
            <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
                <div className="flex items-center justify-between mb-2">
                    <p className={labelClass}>API Key — Pexels (imagens)</p>
                    <a href="https://www.pexels.com/api/" target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline">
                        Obter chave gratuita no Pexels ↗
                    </a>
                </div>
                <div className="relative">
                    <input
                        type={showPexelsKey ? 'text' : 'password'}
                        value={pexelsApiKey}
                        onChange={e => setPexelsApiKey(e.target.value)}
                        placeholder="Chave da API Pexels (opcional)"
                        className={`${inputClass} font-mono pr-12`}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPexelsKey(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted transition-colors"
                    >
                        {showPexelsKey ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                    </button>
                </div>
                <p className="text-xs text-ink-faint mt-1 ml-1">
                    Usada para inserir fotos automaticamente nos posts (1 a cada ~400 palavras, máx. 5).
                </p>
            </div>

            {/* Resultado do teste */}
            {testResult && (
                <div className={`p-4 rounded-md border flex items-start gap-3 text-sm ${testResult.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {testResult.ok ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                    {testResult.message}
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
            )}

            {/* Status atual */}
            <div className="bg-elev rounded-lg border border-border p-4">
                <p className="text-xs font-bold text-ink-faint uppercase tracking-widest mb-3">Status atual</p>
                <div className="space-y-2 text-sm">
                    {[
                        { label: 'Provedor', value: currentProvider.name, color: 'text-ink font-semibold' },
                        { label: 'API Key IA', value: apiKey ? '● Configurada' : '○ Não configurada', color: apiKey ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold' },
                        { label: 'Pexels (imagens)', value: pexelsApiKey ? '● Configurada' : '○ Opcional', color: pexelsApiKey ? 'text-green-600 font-semibold' : 'text-ink-faint' },
                    ].map(row => (
                        <div key={row.label} className="flex justify-between">
                            <span className="text-ink-muted">{row.label}</span>
                            <span className={row.color}>{row.value}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Passo 3+4: Botões */}
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing || !apiKey.trim()}
                    className="px-5 py-2.5 border border-border rounded-md text-sm font-medium text-ink hover:bg-elev disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {testing ? 'Testando...' : '3. Testar Chave'}
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !testedInSession}
                    title={!testedInSession ? 'Teste a chave antes de salvar' : undefined}
                    className="bg-primary hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-none/20"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
                    {saving ? 'Salvando...' : saved ? 'Salvo!' : '4. Salvar Configurações'}
                </button>
            </div>
            {!testedInSession && apiKey.trim() && (
                <p className="text-xs text-ink-faint ml-1">Teste a chave primeiro para habilitar o botão Salvar.</p>
            )}
        </div>
    );
}
