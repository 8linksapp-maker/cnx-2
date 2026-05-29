import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Loader2, Plus, Trash2, Save, Eye, EyeOff, Monitor } from 'lucide-react';
import { triggerToast } from '../CmsToaster';
import { githubApi, atomicCommitApi } from '../../../lib/adminApi';
import VariableField, { type VarDef } from './VariableField';
import type { LocalHome, LocalBusiness, Location, HomeStep, SectionLabel } from '../../../lib/localTypes';

const FIELD = 'w-full bg-elev border border-border rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 outline-none';
const LABEL = 'block text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-2';
const HINT = 'text-[10px] text-ink-faint mt-1.5';

type ShowKey = keyof NonNullable<LocalHome['show']>;
type SectionKey = keyof NonNullable<LocalHome['sections']>;

// Campos da home que vivem no localBusiness (merge-on-save preserva o resto da identidade).
const BIZ_HOME = ['homeTitle', 'homeSubtitle', 'heroImage', 'aboutTitle', 'aboutText'] as const;

export default function HomeEditor() {
    const [home, setHome] = useState<LocalHome>({});
    const [biz, setBiz] = useState<LocalBusiness>({ companyName: '' });
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showPreview, setShowPreview] = useState(true);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        Promise.all([
            githubApi('read', 'src/data/localHome.json').catch(e => { if (e.message.includes('404')) return { content: '{}' }; throw e; }),
            githubApi('read', 'src/data/localBusiness.json').catch(() => ({ content: '{}' })),
            githubApi('read', 'src/data/locations.json').catch(() => ({ content: '[]' })),
        ])
            .then(([h, b, loc]) => {
                setHome(JSON.parse(h?.content || '{}'));
                setBiz({ companyName: '', ...JSON.parse(b?.content || '{}') });
                setLocations(JSON.parse(loc?.content || '[]'));
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    // Prévia ao vivo: manda o rascunho ({biz, home}) pra rota /admin/local/preview
    // (base64 no query), com debounce pra não recarregar a cada tecla.
    useEffect(() => {
        if (loading || !showPreview) return;
        const t = setTimeout(() => {
            try {
                const json = JSON.stringify({ biz, home });
                const b64 = btoa(unescape(encodeURIComponent(json)));
                if (iframeRef.current) iframeRef.current.src = `/admin/local/preview?d=${b64}`;
            } catch { /* payload grande/erro de encode — ignora */ }
        }, 500);
        return () => clearTimeout(t);
    }, [biz, home, showPreview, loading]);

    const patch = (p: Partial<LocalHome>) => setHome(prev => ({ ...prev, ...p }));
    const patchBiz = (p: Partial<LocalBusiness>) => setBiz(prev => ({ ...prev, ...p }));
    const isOn = (k: ShowKey) => home.show?.[k] !== false;
    const toggle = (k: ShowKey) => patch({ show: { ...home.show, [k]: !isOn(k) } });
    const setSection = (k: SectionKey, v: SectionLabel) => patch({ sections: { ...home.sections, [k]: { ...home.sections?.[k], ...v } } });

    const exampleCity = locations.find(l => l.active !== false || l.type === 'cidade');
    const vars: VarDef[] = [
        { token: 'cidade', label: 'cidade', icon: '📍', example: exampleCity?.name || 'São Paulo' },
        { token: 'empresa', label: 'empresa', icon: '🏢', example: biz.companyName || 'sua empresa' },
        { token: 'telefone', label: 'telefone', icon: '📞', example: biz.phone || '(11) 0000-0000' },
        { token: 'estado', label: 'estado', icon: '🗺️', example: exampleCity?.state || 'SP' },
    ];

    // Listas
    const trust = home.trust || [];
    const setTrust = (i: number, v: string) => patch({ trust: trust.map((t, k) => k === i ? v : t) });
    const benefits = home.benefits || [];
    const setBenefit = (i: number, v: string) => patch({ benefits: benefits.map((t, k) => k === i ? v : t) });
    const steps = home.steps || [];
    const setStep = (i: number, p: Partial<HomeStep>) => patch({ steps: steps.map((s, k) => k === i ? { ...s, ...p } : s) });

    const save = async () => {
        setSaving(true); setError('');
        triggerToast('Salvando página inicial...', 'progress', 20);
        try {
            // Merge dos campos da home dentro do localBusiness (sem apagar identidade).
            let latestBiz: any = {};
            try { latestBiz = JSON.parse((await githubApi('read', 'src/data/localBusiness.json'))?.content || '{}'); } catch {}
            const mergedBiz = { ...latestBiz };
            for (const k of BIZ_HOME) mergedBiz[k] = (biz as any)[k] ?? '';

            const cleanHome: LocalHome = {
                ...home,
                trust: trust.map(t => t.trim()).filter(Boolean),
                benefits: benefits.map(t => t.trim()).filter(Boolean),
                steps: steps.map(s => ({ title: s.title.trim(), description: s.description.trim() })).filter(s => s.title || s.description),
            };
            await atomicCommitApi([
                { path: 'src/data/localBusiness.json', content: JSON.stringify(mergedBiz, null, 2) },
                { path: 'src/data/localHome.json', content: JSON.stringify(cleanHome, null, 2) },
            ], 'CMS: atualiza página inicial');
            triggerToast('Página inicial salva!', 'success', 100);
        } catch {
            setError('Não foi possível salvar. Verifique sua conexão.');
            triggerToast('Não foi possível salvar a página inicial.', 'error');
        } finally { setSaving(false); }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-ink-faint bg-surface rounded-lg border border-border">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p className="font-medium animate-pulse">Lendo a página inicial...</p>
        </div>
    );

    const ToggleBtn = ({ k }: { k: ShowKey }) => (
        <button type="button" onClick={() => toggle(k)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition-colors ${isOn(k) ? 'bg-primary-soft text-primary' : 'bg-elev text-ink-faint'}`} aria-pressed={isOn(k)}>
            {isOn(k) ? <Eye className="w-3.5 h-3.5" aria-hidden="true" /> : <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />}
            {isOn(k) ? 'Aparece' : 'Oculta'}
        </button>
    );

    const SectionLabelFields = ({ k }: { k: SectionKey }) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
                <label className={LABEL}>Rótulo pequeno</label>
                <input type="text" value={home.sections?.[k]?.eyebrow || ''} onChange={e => setSection(k, { eyebrow: e.target.value })} className={FIELD} placeholder="o que fazemos" />
            </div>
            <div>
                <label className={LABEL}>Título da seção</label>
                <input type="text" value={home.sections?.[k]?.title || ''} onChange={e => setSection(k, { title: e.target.value })} className={FIELD} placeholder="Nossos serviços" />
            </div>
        </div>
    );

    return (
        <div>
            <div className="sticky top-0 z-30 mb-4 py-2 bg-bg/90 backdrop-blur flex items-center justify-between gap-3 border-b border-border">
                <button type="button" onClick={() => setShowPreview(p => !p)} className="inline-flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-ink px-3 py-2 min-h-[40px] rounded hover:bg-elev transition-colors">
                    <Monitor className="w-4 h-4" aria-hidden="true" /> {showPreview ? 'Ocultar prévia' : 'Ver prévia'}
                </button>
                <button onClick={save} disabled={saving} className="bg-primary hover:brightness-90 disabled:opacity-50 text-surface px-6 py-2.5 min-h-[44px] rounded font-semibold flex items-center gap-2 transition-all">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
                    {saving ? 'Salvando…' : 'Salvar'}
                </button>
            </div>

            <div className="flex flex-col xl:flex-row gap-6">
                <div className="flex-1 min-w-0 space-y-6 pb-12">
            {error && <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200 text-sm"><AlertCircle className="w-4 h-4 inline mr-2 -mt-0.5" />{error}</div>}

            <div className="p-4 bg-elev rounded-md border border-border text-sm text-ink-muted">
                Tudo da sua página inicial fica aqui, na ordem em que aparece no site. Use os botões <strong className="text-ink font-semibold">Inserir</strong> pra colocar a cidade, a empresa, etc. — a prévia mostra como fica. Cada seção tem um botão pra <strong className="text-ink font-semibold">aparecer ou ocultar</strong>.
            </div>

            {/* TOPO */}
            <section className="bg-surface border border-border rounded-lg p-6 space-y-4">
                <h2 className="font-bold text-ink">Topo da página</h2>
                <div>
                    <label htmlFor="home-title" className={LABEL}>Título principal</label>
                    <input id="home-title" type="text" value={biz.homeTitle || ''} onChange={e => patchBiz({ homeTitle: e.target.value })} className={FIELD} placeholder="Aluguel de andaime em São Paulo, com entrega e montagem" />
                </div>
                <div>
                    <label className={LABEL}>Frase de apoio</label>
                    <VariableField value={biz.homeSubtitle || ''} onChange={v => patchBiz({ homeSubtitle: v })} vars={vars} placeholder="Andaimes certificados para obras. Orçamento rápido." aria-label="Frase de apoio do topo" />
                </div>
                <div>
                    <label htmlFor="home-img" className={LABEL}>Imagem de fundo <span className="text-ink-faint normal-case tracking-normal">(cole o endereço de uma imagem — opcional)</span></label>
                    <input id="home-img" type="text" value={biz.heroImage || ''} onChange={e => patchBiz({ heroImage: e.target.value })} className={FIELD + ' font-mono text-xs'} placeholder="/images/local/hero.jpg" />
                </div>
            </section>

            {/* PROVAS */}
            <section className="bg-surface border border-border rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div><h2 className="font-bold text-ink">Provas de confiança</h2><p className="text-sm text-ink-muted">Frases curtas logo abaixo do botão principal.</p></div>
                    <ToggleBtn k="trust" />
                </div>
                {trust.length > 0 && (
                    <div className="space-y-2">
                        {trust.map((t, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <input type="text" value={t} onChange={e => setTrust(i, e.target.value)} className={FIELD} placeholder="Atendemos {cidade} e região" aria-label={`Prova ${i + 1}`} />
                                <button type="button" onClick={() => patch({ trust: trust.filter((_, k) => k !== i) })} className="p-2 text-ink-faint hover:text-red-600 shrink-0" aria-label={`Remover prova ${i + 1}`}><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <button type="button" onClick={() => patch({ trust: [...trust, ''] })} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"><Plus className="w-3 h-3" aria-hidden="true" /> Adicionar prova</button>
                    <span className={HINT}>Você pode usar {'{cidade}'} no texto.</span>
                </div>
            </section>

            {/* SERVIÇOS (rótulos) */}
            <section className="bg-surface border border-border rounded-lg p-6 space-y-4">
                <div><h2 className="font-bold text-ink">Serviços</h2><p className="text-sm text-ink-muted">Os cards vêm de <a href="/admin/local/services" className="text-primary underline">Serviços</a>. Aqui você edita os títulos da seção.</p></div>
                <SectionLabelFields k="servicos" />
            </section>

            {/* COMO FUNCIONA */}
            <section className="bg-surface border border-border rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div><h2 className="font-bold text-ink">Como funciona</h2><p className="text-sm text-ink-muted">Os passos do seu atendimento.</p></div>
                    <ToggleBtn k="comoFunciona" />
                </div>
                <SectionLabelFields k="comoFunciona" />
                {steps.length > 0 && (
                    <div className="space-y-3">
                        {steps.map((s, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <span className="mono text-ink-faint pt-3 w-6 shrink-0 text-center">{i + 1}</span>
                                <div className="flex-1 space-y-2">
                                    <input type="text" value={s.title} onChange={e => setStep(i, { title: e.target.value })} className={FIELD} placeholder="Título do passo" aria-label={`Título do passo ${i + 1}`} />
                                    <textarea rows={2} value={s.description} onChange={e => setStep(i, { description: e.target.value })} className={FIELD + ' resize-y'} placeholder="Descrição do passo (pode usar {cidade})" aria-label={`Descrição do passo ${i + 1}`} />
                                </div>
                                <button type="button" onClick={() => patch({ steps: steps.filter((_, k) => k !== i) })} className="p-2 text-ink-faint hover:text-red-600 shrink-0" aria-label={`Remover passo ${i + 1}`}><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
                            </div>
                        ))}
                    </div>
                )}
                <button type="button" onClick={() => patch({ steps: [...steps, { title: '', description: '' }] })} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"><Plus className="w-3 h-3" aria-hidden="true" /> Adicionar passo</button>
            </section>

            {/* QUEM SOMOS */}
            <section className="bg-surface border border-border rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div><h2 className="font-bold text-ink">Quem somos</h2><p className="text-sm text-ink-muted">Um ou dois parágrafos sobre a empresa.</p></div>
                    <ToggleBtn k="quemSomos" />
                </div>
                <div>
                    <label htmlFor="about-title" className={LABEL}>Título</label>
                    <input id="about-title" type="text" value={biz.aboutTitle || ''} onChange={e => patchBiz({ aboutTitle: e.target.value })} className={FIELD} placeholder="Quem somos" />
                </div>
                <div>
                    <label className={LABEL}>Texto</label>
                    <VariableField value={biz.aboutText || ''} onChange={v => patchBiz({ aboutText: v })} vars={vars} multiline rows={5} placeholder="Conte quem é a empresa, o que faz e o diferencial. Separe parágrafos com uma linha em branco." aria-label="Texto do quem somos" />
                </div>
            </section>

            {/* BENEFÍCIOS */}
            <section className="bg-surface border border-border rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div><h2 className="font-bold text-ink">Benefícios</h2><p className="text-sm text-ink-muted">Vantagens curtas (ex: "Orçamento grátis").</p></div>
                    <ToggleBtn k="benefits" />
                </div>
                {benefits.length > 0 && (
                    <div className="space-y-2">
                        {benefits.map((t, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <input type="text" value={t} onChange={e => setBenefit(i, e.target.value)} className={FIELD} placeholder="Atendimento rápido em {cidade}" aria-label={`Benefício ${i + 1}`} />
                                <button type="button" onClick={() => patch({ benefits: benefits.filter((_, k) => k !== i) })} className="p-2 text-ink-faint hover:text-red-600 shrink-0" aria-label={`Remover benefício ${i + 1}`}><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
                            </div>
                        ))}
                    </div>
                )}
                <button type="button" onClick={() => patch({ benefits: [...benefits, ''] })} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"><Plus className="w-3 h-3" aria-hidden="true" /> Adicionar benefício</button>
            </section>

            {/* ONDE ATENDEMOS */}
            <section className="bg-surface border border-border rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div><h2 className="font-bold text-ink">Onde atendemos</h2><p className="text-sm text-ink-muted">Lista das cidades (vem de <a href="/admin/local/locations" className="text-primary underline">Onde atendemos</a>).</p></div>
                    <ToggleBtn k="ondeAtendemos" />
                </div>
                <SectionLabelFields k="ondeAtendemos" />
            </section>

            {/* CONTATO */}
            <section className="bg-surface border border-border rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div><h2 className="font-bold text-ink">Contato e mapa</h2><p className="text-sm text-ink-muted">Endereço, horário e mapa vêm de <a href="/admin/local/empresa" className="text-primary underline">Minha empresa</a>.</p></div>
                    <ToggleBtn k="contato" />
                </div>
                <SectionLabelFields k="contato" />
            </section>

            {/* FAIXA FINAL */}
            <section className="bg-surface border border-border rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div><h2 className="font-bold text-ink">Faixa de chamada final</h2><p className="text-sm text-ink-muted">A faixa colorida no fim da página.</p></div>
                    <ToggleBtn k="ctaFinal" />
                </div>
                <div>
                    <label htmlFor="cta-title" className={LABEL}>Título</label>
                    <input id="cta-title" type="text" value={home.ctaTitle || ''} onChange={e => patch({ ctaTitle: e.target.value })} className={FIELD} placeholder="Precisa de um orçamento?" />
                </div>
                <div>
                    <label className={LABEL}>Subtítulo</label>
                    <VariableField value={home.ctaSubtitle || ''} onChange={v => patch({ ctaSubtitle: v })} vars={vars} placeholder="Fale agora e receba um orçamento sem compromisso." aria-label="Subtítulo da faixa final" />
                </div>
            </section>

                </div>

                {showPreview && (
                    <aside className="xl:w-[460px] shrink-0">
                        <div className="xl:sticky xl:top-20">
                            <p className="text-[10px] font-bold text-ink-faint uppercase tracking-widest mb-2">Prévia ao vivo</p>
                            <iframe ref={iframeRef} title="Prévia da página inicial" loading="lazy"
                                className="w-full h-[70vh] xl:h-[calc(100vh-9rem)] rounded-md border border-border bg-surface" />
                            <p className="text-[10px] text-ink-faint mt-2">Mostra seu rascunho (ainda não publicado). Atualiza enquanto você edita.</p>
                        </div>
                    </aside>
                )}
            </div>
        </div>
    );
}
