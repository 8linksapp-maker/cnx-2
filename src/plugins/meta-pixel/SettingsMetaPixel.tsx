/**
 * SettingsMetaPixel.tsx — Plugin Meta Pixel
 *
 * UI para configurar o Pixel ID do Meta (Facebook).
 * Salva em src/data/pluginsConfig.json via githubApi().
 */

import { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from '../../components/admin/CmsToaster';

const CONFIG_PATH = 'src/data/pluginsConfig.json';

export default function SettingsMetaPixel() {
    const [pixelId, setPixelId] = useState('');
    const [fileSha, setFileSha] = useState('');
    const [fullConfig, setFullConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [showPixelHelper, setShowPixelHelper] = useState(false);
    const [openAccordion, setOpenAccordion] = useState<'new' | 'existing' | null>(null);

    useEffect(() => {
        githubApi('read', CONFIG_PATH)
            .then(data => {
                const config = JSON.parse(data.content);
                setFullConfig(config);
                setPixelId(config?.metaPixel?.pixelId || '');
                setFileSha(data.sha);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        setError('');
        triggerToast('Salvando configuração do Meta Pixel...', 'progress', 30);
        try {
            const updated = {
                ...fullConfig,
                metaPixel: { pixelId: pixelId.trim() },
            };
            const res = await githubApi('write', CONFIG_PATH, {
                content: JSON.stringify(updated, null, 4),
                sha: fileSha,
                message: 'CMS: Update Meta Pixel ID',
            });
            setFileSha(res.sha || fileSha);
            setFullConfig(updated);
            setSaved(true);
            setShowPixelHelper(true);
            triggerToast('Meta Pixel configurado!', 'success', 100);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            setError(err.message);
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const inputClass = 'w-full bg-surface border border-border rounded-md px-4 py-3 text-sm font-medium text-ink focus:outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/20/20 transition-all shadow-sm font-mono';
    const labelClass = 'block text-sm font-bold text-ink-muted uppercase tracking-wider mb-2 ml-1';

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-3xl border border-border">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p className="font-medium animate-pulse">Carregando configuração...</p>
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
            {/* Pixel ID */}
            <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
                <h3 className="font-bold text-ink mb-1">Pixel ID</h3>
                <p className="text-sm text-ink-muted mb-4">
                    Encontre o Pixel ID no Gerenciador de Eventos do Meta em{' '}
                    <span className="font-mono text-primary">Fontes de dados → Pixels → seu pixel</span>.
                    O formato é um número com{' '}
                    <span className="font-mono font-bold">15–16 dígitos</span>.
                </p>
                <label className={labelClass}>Meta Pixel ID</label>
                <input
                    type="text"
                    value={pixelId}
                    onChange={e => setPixelId(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ex: 1234567890123456"
                    className={inputClass}
                />
                {pixelId && !/^\d{10,20}$/.test(pixelId) && (
                    <p className="text-xs text-amber-600 mt-2 ml-1">
                        O Pixel ID é composto apenas por números. Verifique se está correto.
                    </p>
                )}
            </div>

            {/* Status */}
            <div className="bg-elev rounded-lg border border-border p-4">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-muted">Status</span>
                    {pixelId ? (
                        <span className="flex items-center gap-1.5 text-green-600 font-semibold">
                            <CheckCircle className="w-4 h-4" aria-hidden="true" /> Configurado
                        </span>
                    ) : (
                        <span className="text-ink-faint">Não configurado</span>
                    )}
                </div>
                {pixelId && (
                    <div className="flex items-center justify-between text-sm mt-2">
                        <span className="text-ink-muted">ID ativo</span>
                        <span className="font-mono font-bold text-ink">{pixelId}</span>
                    </div>
                )}
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
            )}

            {/* Botão salvar */}
            <div className="flex items-center gap-3 flex-wrap">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-primary hover:bg-primary disabled:opacity-50 text-white px-6 py-3 rounded-md text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-none/20"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
                    {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configuração'}
                </button>
                <a
                    href="https://business.facebook.com/events_manager"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
                >
                    Abrir Gerenciador de Eventos
                </a>
            </div>

            {showPixelHelper && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                    Para confirmar que está funcionando, instale a extensão gratuita "Meta Pixel Helper" no Chrome e visite seu site.
                </div>
            )}

            {/* Instruções em accordion */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 overflow-hidden">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest px-5 pt-4 pb-2">Como configurar</p>

                {/* Trilha 1 */}
                <div className="border-t border-blue-200">
                    <button
                        type="button"
                        onClick={() => setOpenAccordion(openAccordion === 'new' ? null : 'new')}
                        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-100 transition-colors text-left"
                    >
                        Criar meu primeiro Pixel
                        <span className="text-blue-500 text-xs">{openAccordion === 'new' ? '▲' : '▼'}</span>
                    </button>
                    {openAccordion === 'new' && (
                        <ol className="px-5 pb-4 space-y-2">
                            {[
                                'Acesse business.facebook.com e vá em Gerenciador de Eventos',
                                'Clique em "Conectar fontes de dados" → Web → Meta Pixel',
                                'Dê um nome ao pixel e clique em Continuar',
                                'Copie o Pixel ID exibido (número de 15–16 dígitos)',
                                'Cole aqui e clique em Salvar Configuração',
                            ].map((step, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-sm text-blue-800">
                                    <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                        {i + 1}
                                    </span>
                                    {step}
                                </li>
                            ))}
                        </ol>
                    )}
                </div>

                {/* Trilha 2 */}
                <div className="border-t border-blue-200">
                    <button
                        type="button"
                        onClick={() => setOpenAccordion(openAccordion === 'existing' ? null : 'existing')}
                        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-100 transition-colors text-left"
                    >
                        Ja tenho um Pixel — onde encontrar o ID
                        <span className="text-blue-500 text-xs">{openAccordion === 'existing' ? '▲' : '▼'}</span>
                    </button>
                    {openAccordion === 'existing' && (
                        <ol className="px-5 pb-4 space-y-2">
                            {[
                                'Acesse business.facebook.com/events_manager',
                                'No menu esquerdo, selecione seu pixel',
                                'O Pixel ID aparece logo abaixo do nome do pixel (número de 15–16 dígitos)',
                                'Copie e cole aqui',
                            ].map((step, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-sm text-blue-800">
                                    <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                        {i + 1}
                                    </span>
                                    {step}
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </div>
        </div>
    );
}
