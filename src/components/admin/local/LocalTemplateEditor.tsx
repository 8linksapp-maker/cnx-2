import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2, Plus, Trash2, Save, Info } from 'lucide-react';
import { triggerToast } from '../CmsToaster';
import { githubApi, atomicCommitApi } from '../../../lib/adminApi';
import type { LocalTemplate, LocalBusiness } from '../../../lib/localTypes';

const VARS: { token: string; desc: string }[] = [
    { token: '{cidade}', desc: 'cidade ou bairro da página' },
    { token: '{estado}', desc: 'UF (ex: SP)' },
    { token: '{servico}', desc: 'nome do serviço' },
    { token: '{empresa}', desc: 'nome da sua empresa' },
    { token: '{telefone}', desc: 'telefone de contato' },
];

const FIELD = 'w-full bg-elev border border-border rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 outline-none';
const LABEL = 'block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2';

export default function LocalTemplateEditor() {
    const [tpl, setTpl] = useState<LocalTemplate>({});
    const [biz, setBiz] = useState<LocalBusiness>({ companyName: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        Promise.all([
            githubApi('read', 'src/data/localTemplate.json').catch(() => ({ content: '{}' })),
            githubApi('read', 'src/data/localBusiness.json').catch(() => ({ content: '{}' })),
        ])
            .then(([t, b]) => {
                setTpl(JSON.parse(t?.content || '{}'));
                const parsedBiz = JSON.parse(b?.content || '{}');
                setBiz({ companyName: '', ...parsedBiz });
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const patchTpl = (p: Partial<LocalTemplate>) => setTpl(prev => ({ ...prev, ...p }));
    const patchBiz = (p: Partial<LocalBusiness>) => setBiz(prev => ({ ...prev, ...p }));

    const benefits = tpl.benefits || [];
    const setBenefit = (i: number, v: string) => patchTpl({ benefits: benefits.map((b, k) => k === i ? v : b) });
    const addBenefit = () => patchTpl({ benefits: [...benefits, ''] });
    const removeBenefit = (i: number) => patchTpl({ benefits: benefits.filter((_, k) => k !== i) });

    const save = async () => {
        setSaving(true); setError('');
        triggerToast('Salvando modelo...', 'progress', 20);
        try {
            const cleanTpl: LocalTemplate = { ...tpl, benefits: benefits.map(b => b.trim()).filter(Boolean) };
            await atomicCommitApi([
                { path: 'src/data/localTemplate.json', content: JSON.stringify(cleanTpl, null, 2) },
                { path: 'src/data/localBusiness.json', content: JSON.stringify(biz, null, 2) },
            ], 'CMS: atualiza modelo de página local e dados da empresa');
            triggerToast('Modelo salvo!', 'success', 100);
        } catch {
            setError('Não foi possível salvar. Verifique sua conexão.');
            triggerToast('Não foi possível salvar o modelo.', 'error');
        } finally { setSaving(false); }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-lg border border-border">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p className="font-medium animate-pulse">Lendo o modelo...</p>
        </div>
    );

    return (
        <div className="space-y-6 pb-32">
            {error && <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200 text-sm"><AlertCircle className="w-4 h-4 inline mr-2 -mt-0.5" />{error}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Dados da empresa */}
                    <section className="bg-surface border border-border rounded-lg p-6 space-y-4">
                        <div>
                            <h2 className="font-bold text-ink">Dados da empresa</h2>
                            <p className="text-sm text-ink-muted">Alimentam as variáveis {'{empresa}'}/{'{telefone}'} e os botões de contato.</p>
                        </div>
                        <div>
                            <label htmlFor="biz-name" className={LABEL}>Nome da empresa</label>
                            <input id="biz-name" type="text" value={biz.companyName || ''} onChange={e => patchBiz({ companyName: e.target.value })} className={FIELD} placeholder="Andaimes SP" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="biz-phone" className={LABEL}>Telefone</label>
                                <input id="biz-phone" type="tel" value={biz.phone || ''} onChange={e => patchBiz({ phone: e.target.value })} className={FIELD} placeholder="(11) 4000-0000" />
                            </div>
                            <div>
                                <label htmlFor="biz-wa" className={LABEL}>WhatsApp <span className="text-ink-faint normal-case tracking-normal">(com DDI/DDD, só números)</span></label>
                                <input id="biz-wa" type="text" inputMode="numeric" value={biz.whatsapp || ''} onChange={e => patchBiz({ whatsapp: e.target.value.replace(/\D/g, '') })} className={FIELD} placeholder="5511940000000" />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="biz-wamsg" className={LABEL}>Mensagem inicial do WhatsApp</label>
                            <input id="biz-wamsg" type="text" value={biz.whatsappMessage || ''} onChange={e => patchBiz({ whatsappMessage: e.target.value })} className={FIELD} placeholder="Olá! Vim pelo site e gostaria de um orçamento." />
                        </div>
                    </section>

                    {/* Modelo de página */}
                    <section className="bg-surface border border-border rounded-lg p-6 space-y-4">
                        <div>
                            <h2 className="font-bold text-ink">Modelo de página</h2>
                            <p className="text-sm text-ink-muted">Usado quando um serviço ainda não tem conteúdo próprio gerado.</p>
                        </div>
                        <div>
                            <label htmlFor="tpl-herotitle" className={LABEL}>Título do topo</label>
                            <input id="tpl-herotitle" type="text" value={tpl.heroTitle || ''} onChange={e => patchTpl({ heroTitle: e.target.value })} className={FIELD} placeholder="{servico} em {cidade} - {estado}" />
                        </div>
                        <div>
                            <label htmlFor="tpl-herosub" className={LABEL}>Subtítulo do topo</label>
                            <input id="tpl-herosub" type="text" value={tpl.heroSubtitle || ''} onChange={e => patchTpl({ heroSubtitle: e.target.value })} className={FIELD} placeholder="Atendimento de {servico} em {cidade}…" />
                        </div>
                        <div>
                            <label htmlFor="tpl-content" className={LABEL}>Texto da página</label>
                            <textarea id="tpl-content" rows={5} value={tpl.pageContent || ''} onChange={e => patchTpl({ pageContent: e.target.value })} className={FIELD + ' resize-y'} placeholder="Procurando {servico} em {cidade}? A {empresa}…" />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className={LABEL + ' mb-0'}>Benefícios</span>
                                <button type="button" onClick={addBenefit} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"><Plus className="w-3 h-3" aria-hidden="true" /> Adicionar</button>
                            </div>
                            {benefits.length === 0 ? (
                                <p className="text-xs text-ink-faint bg-elev rounded-md px-4 py-3">Sem benefícios. Adicione frases curtas (ex: "Orçamento grátis").</p>
                            ) : (
                                <div className="space-y-2">
                                    {benefits.map((b, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <input type="text" value={b} onChange={e => setBenefit(i, e.target.value)} className={FIELD} placeholder="Atendimento rápido em {cidade}" aria-label={`Benefício ${i + 1}`} />
                                            <button type="button" onClick={() => removeBenefit(i)} className="p-2 text-ink-faint hover:text-red-600 shrink-0" aria-label={`Remover benefício ${i + 1}`}><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="tpl-metatitle" className={LABEL}>Título no Google (SEO)</label>
                                <input id="tpl-metatitle" type="text" value={tpl.metaTitle || ''} onChange={e => patchTpl({ metaTitle: e.target.value })} className={FIELD} placeholder="{servico} em {cidade} | {empresa}" />
                            </div>
                            <div>
                                <label htmlFor="tpl-metadesc" className={LABEL}>Descrição no Google (SEO)</label>
                                <input id="tpl-metadesc" type="text" value={tpl.metaDescription || ''} onChange={e => patchTpl({ metaDescription: e.target.value })} className={FIELD} placeholder="Precisa de {servico} em {cidade}? Orçamento grátis." />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Variáveis */}
                <aside className="lg:col-span-1">
                    <div className="bg-surface border border-border rounded-lg p-5 lg:sticky lg:top-6">
                        <h3 className="font-bold text-ink flex items-center gap-2 mb-1"><Info className="w-4 h-4 text-ink-faint" aria-hidden="true" /> Variáveis</h3>
                        <p className="text-xs text-ink-muted mb-4">Escreva estes códigos no texto. Eles viram o valor real de cada cidade na hora de publicar.</p>
                        <ul className="space-y-2">
                            {VARS.map(v => (
                                <li key={v.token} className="flex items-start gap-2">
                                    <code className="bg-elev text-primary font-mono text-xs px-1.5 py-0.5 rounded shrink-0">{v.token}</code>
                                    <span className="text-xs text-ink-muted">{v.desc}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>
            </div>

            {/* Barra de salvar */}
            <div className="fixed bottom-0 left-64 right-0 bg-surface/90 backdrop-blur border-t border-border px-8 py-4 flex justify-end z-40">
                <button onClick={save} disabled={saving} className="bg-primary hover:brightness-90 disabled:opacity-50 text-surface px-6 py-2.5 min-h-[44px] rounded font-semibold flex items-center gap-2 transition-all">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
                    {saving ? 'Salvando…' : 'Salvar modelo'}
                </button>
            </div>
        </div>
    );
}
